import Foundation

enum HealthTargetPolicy: String, Codable {
    case evening = "D_EVENING"
    case overnight = "D_OVERNIGHT"
    case previousDay = "D_MINUS_1"
}

struct HealthTargetContext: Equatable {
    let targetDate: Date
    let targetDateKey: String
    let policy: HealthTargetPolicy
    let label: String
}

enum HealthOperationalDatePolicy {
    static let timeZone = TimeZone(identifier: "Asia/Kolkata")!

    static func context(for instant: Date) -> HealthTargetContext {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let calendarDay = calendar.startOfDay(for: instant)
        let hour = calendar.component(.hour, from: instant)
        let targetDate: Date
        let policy: HealthTargetPolicy
        let label: String

        if hour >= 20 {
            targetDate = calendarDay
            policy = .evening
            label = "D · evening cutoff"
        } else {
            targetDate = calendar.date(byAdding: .day, value: -1, to: calendarDay)!
            if hour < 2 {
                policy = .overnight
                label = "D · overnight window"
            } else {
                policy = .previousDay
                label = "D-1"
            }
        }

        return HealthTargetContext(
            targetDate: targetDate,
            targetDateKey: machineDayFormatter.string(from: targetDate),
            policy: policy,
            label: label
        )
    }

    private static let machineDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
