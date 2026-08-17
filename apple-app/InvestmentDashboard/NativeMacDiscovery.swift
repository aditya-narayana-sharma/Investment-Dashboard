import Combine
import Foundation
import Network

struct DiscoveredMacEndpoint: Identifiable, Equatable {
    var id: String { url.absoluteString }
    let name: String
    let url: URL
}

@MainActor
final class NativeMacDiscovery: ObservableObject {
    @Published private(set) var endpoints: [DiscoveredMacEndpoint] = []
    @Published private(set) var status = "Looking for Stratji on this Wi-Fi…"
    @Published private(set) var isBrowsing = false

    private var browser: NWBrowser?
    private var resolvers: [ObjectIdentifier: NWConnection] = [:]

    func start() {
        stop()
        isBrowsing = true
        status = "Looking for Stratji on this Wi-Fi…"
        let parameters = NWParameters()
        parameters.includePeerToPeer = true
        let next = NWBrowser(for: .bonjour(type: PortfolioDashboardConfiguration.bonjourServiceType, domain: "local."), using: parameters)
        next.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                switch state {
                case .ready:
                    self?.status = "Select your Mac, or enter its LAN address."
                case .failed(let error):
                    self?.status = "Local discovery failed: \(error.localizedDescription)"
                    self?.isBrowsing = false
                case .waiting(let error):
                    self?.status = "Waiting for local network permission: \(error.localizedDescription)"
                default:
                    break
                }
            }
        }
        next.browseResultsChangedHandler = { [weak self] results, _ in
            Task { @MainActor in
                self?.resolve(results)
            }
        }
        browser = next
        next.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        resolvers.values.forEach { $0.cancel() }
        resolvers.removeAll()
        isBrowsing = false
    }

    private func resolve(_ results: Set<NWBrowser.Result>) {
        if results.isEmpty {
            endpoints = []
            status = "No Mac found yet. Keep Stratji running, stay on the same Wi-Fi, then retry."
            return
        }
        for result in results {
            let connection = NWConnection(to: result.endpoint, using: .tcp)
            resolvers[ObjectIdentifier(connection)] = connection
            connection.stateUpdateHandler = { [weak self, weak connection] state in
                guard let connection else { return }
                Task { @MainActor in
                    self?.handleResolved(connection, named: self?.serviceName(result.endpoint) ?? "Stratji", state: state)
                }
            }
            connection.start(queue: .main)
        }
    }

    private func handleResolved(_ connection: NWConnection, named name: String, state: NWConnection.State) {
        switch state {
        case .ready:
            if let url = url(from: connection.currentPath?.remoteEndpoint, fallbackName: name) {
                let item = DiscoveredMacEndpoint(name: name, url: url)
                if !endpoints.contains(item) {
                    endpoints.append(item)
                    endpoints.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                }
                status = "Found \(endpoints.count) Mac\(endpoints.count == 1 ? "" : "s") on this Wi-Fi."
            }
            connection.cancel()
            resolvers[ObjectIdentifier(connection)] = nil
        case .failed, .cancelled:
            resolvers[ObjectIdentifier(connection)] = nil
        default:
            break
        }
    }

    private func serviceName(_ endpoint: NWEndpoint) -> String? {
        if case .service(let name, _, _, _) = endpoint {
            return name
        }
        return nil
    }

    private func url(from endpoint: NWEndpoint?, fallbackName: String) -> URL? {
        guard case .hostPort(let host, let port) = endpoint else {
            return PortfolioDashboardConfiguration.normalizedServerURL(from: "http://\(fallbackName).local:5050")
        }
        let hostname: String
        switch host {
        case .name(let value, _):
            hostname = value
        case .ipv4(let address):
            hostname = String(describing: address)
        case .ipv6(let address):
            hostname = "[\(String(describing: address))]"
        @unknown default:
            return nil
        }
        let portValue = port.rawValue == 0 ? 5050 : Int(port.rawValue)
        return PortfolioDashboardConfiguration.normalizedServerURL(from: "http://\(hostname):\(portValue)")
    }
}
