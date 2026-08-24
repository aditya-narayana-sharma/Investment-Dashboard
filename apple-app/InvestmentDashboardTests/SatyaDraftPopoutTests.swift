import Foundation
import Testing
@testable import InvestmentDashboard

struct SatyaDraftPopoutTests {
    @Test func parsesOpenPayloadWithCurrentTurnAndCitationKinds() {
        let payload = StratjiSatyaDraftPayload.parse([
            "action": "open",
            "sessionId": "sess-1",
            "drafting": true,
            "turns": [
                ["id": "user-1", "role": "user", "text": "What did Axis say about HDFC Bank?", "citations": []],
                [
                    "id": "assistant-1",
                    "role": "assistant",
                    "text": "Drafting a long-form answer…",
                    "citations": [
                        [
                            "family": "axis_research",
                            "title": "Result Update",
                            "messageUrl": "message://axis-1",
                            "pdfUrl": "https://example.test/axis.pdf",
                        ],
                        [
                            "family": "earnings",
                            "title": "HDFCBANK print",
                            "sourceUrl": "https://ir.example.test/hdfcbank",
                        ],
                    ],
                ],
            ],
        ] as [String: Any])

        #expect(payload?.action == "open")
        #expect(payload?.sessionId == "sess-1")
        #expect(payload?.drafting == true)
        #expect(payload?.turns.count == 2)
        #expect(payload?.turns[0].role == "user")
        #expect(payload?.turns[1].citationKinds == [.mail, .pdf, .earnings])
    }

    @Test func draftStatusPhrasesAreProcessLabelsNotDrafting() {
        #expect(StratjiSatyaDraftStatus.phrases.contains("Thinking…"))
        #expect(StratjiSatyaDraftStatus.phrases.contains("Going through Research…"))
        #expect(StratjiSatyaDraftStatus.phrases.contains("Analyzing KPIs…"))
        #expect(!StratjiSatyaDraftStatus.phrases.contains("Drafting…"))
        #expect(StratjiSatyaDraftStatus.phrase(tick: 0, reduceMotion: true) == "Thinking…")
        #expect(StratjiSatyaDraftStatus.phrase(tick: 9, reduceMotion: true) == "Thinking…")
        #expect(StratjiSatyaDraftStatus.phrase(tick: 1, reduceMotion: false) == "Going through Research…")
    }

    @Test func closeActionDoesNotRequireTurns() {
        let payload = StratjiSatyaDraftPayload.parse([
            "action": "close",
            "sessionId": "sess-1",
            "drafting": false,
            "turns": [] as [Any],
        ] as [String: Any])
        #expect(payload?.action == "close")
        #expect(payload?.turns.isEmpty == true)
        #expect(payload?.drafting == false)
    }

    @Test func ignoresUnknownRolesAndNullPdfUrls() {
        let kinds = StratjiSatyaDraftPayload.citationKinds(from: [
            "family": "groww_digest",
            "pdfUrl": NSNull(),
            "messageUrl": "message://groww",
        ])
        #expect(kinds == [.mail])
        #expect(StratjiSatyaDraftPayload.parse(["action": "update", "turns": [
            ["id": "x", "role": "system", "text": "nope"],
        ]])?.turns.isEmpty == true)
    }

    @Test func workspaceRouteScriptDoesNotStartTheDataPlane() {
        let base = URL(string: "http://127.0.0.1:5050/")!
        let destination = DashboardOutline.destination(id: "sectors")!
        let script = DashboardNativeRoute.applyJavaScript(
            url: destination.url(baseURL: base, nativeChrome: true),
            destination: destination
        )
        #expect(script.contains("view=sectors"))
        #expect(!script.contains("start-flask-app"))
        #expect(!script.contains("persistRepoRoot"))
        #expect(!script.contains("Documents"))
        #expect(!script.contains("start-dashboard"))
    }
}
