import AVFoundation
import Foundation
import Speech
import WebKit

/// Push-to-talk speech for Satya. JS posts `{ action: "start"|"stop"|"cancel"|"speak", text? }`
/// to `webkit.messageHandlers.satyaSpeech`. Native pushes `onPartial` / `onFinal` / `onSpeechEnd`
/// on `window.satyaSpeech`. A late TCC grant after stop/cancel must not start the mic.
final class StratjiSatyaSpeechBridge: NSObject, WKScriptMessageHandler, AVSpeechSynthesizerDelegate, SFSpeechRecognizerDelegate {
    static let messageName = "satyaSpeech"

    weak var webView: WKWebView?

    private let synthesizer = AVSpeechSynthesizer()
    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var lastPartial = ""
    private var tapInstalled = false
    /// Bumped on start/stop/cancel so a TCC prompt that outlives a PTT release cannot start the mic.
    private var listenGeneration: UInt64 = 0
    private var wantsListening = false
    private var permissionTask: Task<Void, Never>?

    override init() {
        super.init()
        synthesizer.delegate = self
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-IN"))
            ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
            ?? SFSpeechRecognizer()
        recognizer?.delegate = self
    }

    private var selectedVoiceId: String?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let action: String
        var speakText = ""
        var voiceId: String?
        if let raw = message.body as? String {
            action = raw.lowercased()
        } else if let record = message.body as? [String: Any] {
            action = String(describing: record["action"] ?? "").lowercased()
            speakText = record["text"] as? String ?? ""
            voiceId = record["voice"] as? String
        } else {
            return
        }
        DispatchQueue.main.async { [weak self] in
            switch action {
            case "start":
                self?.startListening()
            case "stop":
                self?.stopListening(finalize: true)
            case "cancel":
                self?.cancelListening()
            case "speak":
                if let voiceId, !voiceId.isEmpty {
                    self?.selectedVoiceId = voiceId
                }
                self?.speak(speakText)
            case "setvoice":
                self?.selectedVoiceId = voiceId?.isEmpty == false ? voiceId : nil
            case "voices":
                self?.pushVoices()
            default:
                break
            }
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        pushCallback(name: "onSpeechEnd", argument: nil)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        pushCallback(name: "onSpeechEnd", argument: nil)
    }

    private func startListening() {
        synthesizer.stopSpeaking(at: .immediate)
        haltRecognition(finalize: false)
        lastPartial = ""
        listenGeneration += 1
        let generation = listenGeneration
        wantsListening = true

        permissionTask?.cancel()
        permissionTask = Task { [weak self] in
            let allowed = await Self.requestAccess()
            await MainActor.run {
                guard let self else { return }
                guard self.wantsListening, self.listenGeneration == generation else { return }
                guard allowed else {
                    self.wantsListening = false
                    self.pushCallback(name: "onFinal", argument: "")
                    return
                }
                self.beginRecognition(generation: generation)
            }
        }
    }

    private static func requestAccess() async -> Bool {
        let speechGranted: Bool = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status == .authorized)
            }
        }
        let micGranted: Bool = await withCheckedContinuation { continuation in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                continuation.resume(returning: granted)
            }
        }
        return speechGranted && micGranted
    }

    private func beginRecognition(generation: UInt64) {
        guard wantsListening, listenGeneration == generation else { return }
        guard let recognizer, recognizer.isAvailable else {
            wantsListening = false
            return
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        if tapInstalled {
            input.removeTap(onBus: 0)
            tapInstalled = false
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        tapInstalled = true
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            haltRecognition(finalize: false)
            wantsListening = false
            return
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                guard self.wantsListening, self.listenGeneration == generation else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    self.lastPartial = text
                    if result.isFinal {
                        self.pushCallback(name: "onFinal", argument: text)
                        self.stopListening(finalize: false)
                    } else {
                        self.pushCallback(name: "onPartial", argument: text)
                    }
                }
                if error != nil {
                    if !self.lastPartial.isEmpty {
                        self.pushCallback(name: "onFinal", argument: self.lastPartial)
                    }
                    self.stopListening(finalize: false)
                }
            }
        }
    }

    private func cancelListening() {
        synthesizer.stopSpeaking(at: .immediate)
        stopListening(finalize: false)
    }

    private func stopListening(finalize: Bool) {
        listenGeneration += 1
        wantsListening = false
        permissionTask?.cancel()
        permissionTask = nil
        haltRecognition(finalize: finalize)
    }

    private func haltRecognition(finalize: Bool) {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        if finalize {
            task?.finish()
            if !lastPartial.isEmpty {
                pushCallback(name: "onFinal", argument: lastPartial)
            }
        } else {
            task?.cancel()
        }
        request = nil
        task = nil
        lastPartial = ""
    }

    private func speak(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            pushCallback(name: "onSpeechEnd", argument: nil)
            return
        }
        stopListening(finalize: false)
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: trimmed)
        if let selectedVoiceId, let chosen = AVSpeechSynthesisVoice(identifier: selectedVoiceId) {
            utterance.voice = chosen
        } else {
            utterance.voice = AVSpeechSynthesisVoice(language: "en-IN")
                ?? AVSpeechSynthesisVoice(language: "en-US")
        }
        synthesizer.speak(utterance)
    }

    private func pushVoices() {
        struct VoiceRow: Encodable {
            let id: String
            let name: String
            let lang: String
        }
        let rows = AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.lowercased().hasPrefix("en") }
            .map { VoiceRow(id: $0.identifier, name: $0.name, lang: $0.language) }
        let data = (try? JSONEncoder().encode(rows)) ?? Data("[]".utf8)
        let json = String(data: data, encoding: .utf8) ?? "[]"
        let js = "(function(){var a=window.satyaSpeech;if(a&&typeof a.onVoices==='function')a.onVoices(\(json));})();"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private func pushCallback(name: String, argument: String?) {
        let payload: String
        if let argument {
            let encoded = String(data: (try? JSONEncoder().encode(argument)) ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
            payload = encoded
        } else {
            payload = ""
        }
        let js: String
        switch name {
        case "onPartial":
            js = "(function(){var a=window.satyaSpeech;if(a&&typeof a.onPartial==='function')a.onPartial(\(payload));})();"
        case "onFinal":
            js = "(function(){var a=window.satyaSpeech;if(a&&typeof a.onFinal==='function')a.onFinal(\(payload));})();"
        case "onSpeechEnd":
            js = "(function(){var a=window.satyaSpeech;if(a&&typeof a.onSpeechEnd==='function')a.onSpeechEnd();})();"
        default:
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}
