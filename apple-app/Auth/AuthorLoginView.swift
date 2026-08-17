import SwiftUI

struct AuthorLoginView: View {
    @ObservedObject var auth: AuthenticationService
    var onAuthenticated: (() -> Void)?

    var body: some View {
        VStack(spacing: 22) {
            Spacer()
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(Color.accentColor)
            Text("Stratji")
                .font(.largeTitle.bold())
            Text("Author sign-in")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Unlock as the owner of this Stratji install. On Mac, Stratji uses Touch ID or the Mac login password. Auth0 Universal Login is optional and is not required when Auth0.plist still has placeholders.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 420)
            if auth.isConfigured {
                Button {
                    Task {
                        await auth.login()
                        if auth.isAuthenticated {
                            onAuthenticated?()
                        }
                    }
                } label: {
                    if auth.isBusy {
                        ProgressView()
                            .controlSize(.small)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Log in with Auth0")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(auth.isBusy)
                .frame(maxWidth: 320)
            } else {
                Text(AuthorAuthError.notConfigured.localizedDescription)
                    .font(.callout)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
                Text("Run scripts/auth0-register-native-apps.sh after auth0 login, then replace the YOUR_ placeholders in Auth0.plist.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
            }
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
        .onChange(of: auth.isAuthenticated) { _, authenticated in
            if authenticated {
                onAuthenticated?()
            }
        }
    }
}
