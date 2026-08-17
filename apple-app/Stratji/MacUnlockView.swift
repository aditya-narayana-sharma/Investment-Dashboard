import SwiftUI

struct MacUnlockView: View {
    @ObservedObject var auth: AuthenticationService
    var onUnlocked: (() -> Void)?

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(Color.accentColor)
            Text("Stratji")
                .font(.largeTitle.bold())
            Text("Unlock this Mac session")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Use Touch ID or your Mac login password. Unlock lasts until you choose Lock or quit Stratji. Auth0 is not required.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
            Button {
                Task {
                    await auth.unlockWithLocalAuthentication()
                    if auth.isAuthenticated {
                        onUnlocked?()
                    }
                }
            } label: {
                if auth.isBusy {
                    ProgressView()
                        .controlSize(.small)
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Unlock with Touch ID or password")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(auth.isBusy)
            .frame(maxWidth: 320)
            if let lastError = auth.lastError {
                Text(lastError)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
            Spacer()
        }
        .padding(36)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .onAppear {
            Task {
                await auth.unlockWithLocalAuthentication()
                if auth.isAuthenticated {
                    onUnlocked?()
                }
            }
        }
        .onChange(of: auth.isAuthenticated) { _, authenticated in
            if authenticated {
                onUnlocked?()
            }
        }
    }
}
