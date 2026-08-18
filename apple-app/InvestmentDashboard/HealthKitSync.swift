#if os(iOS)
import Combine
import Foundation
import HealthKit

private struct DashboardHealthAverage: Codable {
    let value: String
    let direction: String
    let delta: String?
}

private struct DashboardHealthHistoryPoint: Codable {
    let date: String
    let value: Double
}

private struct DashboardHealthMetric: Codable {
    let label: String
    let value: String
    let context: String
    let tone: String?
    let averages: [String: DashboardHealthAverage]
    let history: [String: [DashboardHealthHistoryPoint]]
}

private struct DashboardHealthCategory: Codable {
    let name: String
    let note: String
    let tone: String
    let metrics: [DashboardHealthMetric]
}

private struct DashboardHealthSource: Codable {
    let source: String
    let status: String
    let detail: String
    let tone: String
}

private struct DashboardHealthAction: Codable {
    let tone: String
    let title: String
    let text: String
}

private struct DashboardHealthSnapshot: Codable {
    let schemaVersion = 1
    let status: String
    let source = "Apple Health"
    let dataDate: String
    let targetDate: String
    let targetPolicy: String
    let targetLabel: String
    let requiredThrough: String
    let eligibleThrough: String
    let capturedAt: String
    let message: String
    let categories: [DashboardHealthCategory]
    let sources: [DashboardHealthSource]
    let actions: [DashboardHealthAction]
}

private enum HealthAggregation {
    case sum
    case average
    case range
}

private struct QuantityMetricDescriptor {
    let category: String
    let categoryTone: String
    let label: String
    let identifier: HKQuantityTypeIdentifier
    let unit: HKUnit
    let aggregation: HealthAggregation
    let tone: String?
    let format: (Double) -> String
}

@MainActor
final class HealthKitSyncCoordinator: ObservableObject {
    @Published private(set) var status = "HealthKit not synced"
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSyncedAt: Date?

    private let healthStore = HKHealthStore()

    func sync(to dashboardURL: URL) async {
        guard !isSyncing else { return }
        guard HealthCredentialStore.isPaired else {
            status = "Pair HealthKit with the Mac in Settings"
            return
        }
        guard HKHealthStore.isHealthDataAvailable() else {
            status = "HealthKit unavailable"
            return
        }

        isSyncing = true
        status = "Reading operational Health day"
        defer { isSyncing = false }

        do {
            let descriptors = quantityDescriptors
            var readTypes = Set(descriptors.compactMap { HKQuantityType.quantityType(forIdentifier: $0.identifier) as HKObjectType? })
            if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
                readTypes.insert(sleep)
            }
            try await healthStore.requestAuthorization(toShare: [], read: readTypes)

            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = HealthOperationalDatePolicy.timeZone
            let target = HealthOperationalDatePolicy.context(for: Date())
            let snapshot = try await buildSnapshot(for: target, descriptors: descriptors, calendar: calendar)
            try await upload(snapshot, to: dashboardURL)
            status = "HealthKit synced through \(snapshot.dataDate)"
            lastSyncedAt = Date()
        } catch {
            status = "HealthKit sync failed: \(error.localizedDescription)"
        }
    }

    private var quantityDescriptors: [QuantityMetricDescriptor] {
        let integer: (Double) -> String = { String(Int($0.rounded())) }
        let oneDecimal: (Double) -> String = { String(format: "%.1f", $0) }
        return [
            .init(category: "Activity", categoryTone: "green", label: "Active energy", identifier: .activeEnergyBurned, unit: .kilocalorie(), aggregation: .sum, tone: nil, format: { "\(integer($0)) kcal" }),
            .init(category: "Activity", categoryTone: "green", label: "Exercise minutes", identifier: .appleExerciseTime, unit: .minute(), aggregation: .sum, tone: nil, format: { "\(integer($0)) min" }),
            .init(category: "Activity", categoryTone: "green", label: "Resting energy", identifier: .basalEnergyBurned, unit: .kilocalorie(), aggregation: .sum, tone: nil, format: { "\(integer($0)) kcal" }),
            .init(category: "Activity", categoryTone: "green", label: "Steps", identifier: .stepCount, unit: .count(), aggregation: .sum, tone: nil, format: { integer($0) }),
            .init(category: "Activity", categoryTone: "green", label: "Walking + running", identifier: .distanceWalkingRunning, unit: .meterUnit(with: .kilo), aggregation: .sum, tone: nil, format: { "\(oneDecimal($0)) km" }),
            .init(category: "Activity", categoryTone: "green", label: "Stairs climbed", identifier: .flightsClimbed, unit: .count(), aggregation: .sum, tone: nil, format: { "\(integer($0)) floors" }),

            .init(category: "Heart", categoryTone: "red", label: "Heart rate", identifier: .heartRate, unit: .count().unitDivided(by: .minute()), aggregation: .range, tone: nil, format: { "\(integer($0)) bpm" }),
            .init(category: "Heart", categoryTone: "red", label: "Resting heart rate", identifier: .restingHeartRate, unit: .count().unitDivided(by: .minute()), aggregation: .average, tone: nil, format: { "\(integer($0)) bpm" }),
            .init(category: "Heart", categoryTone: "red", label: "Walking HR avg", identifier: .walkingHeartRateAverage, unit: .count().unitDivided(by: .minute()), aggregation: .average, tone: nil, format: { "\(integer($0)) bpm" }),
            .init(category: "Heart", categoryTone: "red", label: "HRV", identifier: .heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), aggregation: .range, tone: nil, format: { "\(integer($0)) ms" }),

            .init(category: "Respiratory", categoryTone: "blue", label: "Blood oxygen", identifier: .oxygenSaturation, unit: .percent(), aggregation: .range, tone: nil, format: { "\(oneDecimal($0 * 100))%" }),
            .init(category: "Respiratory", categoryTone: "blue", label: "Respiratory rate", identifier: .respiratoryRate, unit: .count().unitDivided(by: .minute()), aggregation: .range, tone: nil, format: { "\(oneDecimal($0)) / min" }),

            .init(category: "Mobility", categoryTone: "amber", label: "Walking speed", identifier: .walkingSpeed, unit: .meter().unitDivided(by: .second()), aggregation: .range, tone: nil, format: { "\(oneDecimal($0 * 3.6)) km/h" }),
            .init(category: "Mobility", categoryTone: "amber", label: "Step length", identifier: .walkingStepLength, unit: .meterUnit(with: .centi), aggregation: .range, tone: nil, format: { "\(oneDecimal($0)) cm" }),
            .init(category: "Mobility", categoryTone: "amber", label: "Double support", identifier: .walkingDoubleSupportPercentage, unit: .percent(), aggregation: .average, tone: nil, format: { "\(oneDecimal($0 * 100))%" }),
            .init(category: "Mobility", categoryTone: "amber", label: "Walking asymmetry", identifier: .walkingAsymmetryPercentage, unit: .percent(), aggregation: .average, tone: nil, format: { "\(oneDecimal($0 * 100))%" }),

            .init(category: "Nutrition", categoryTone: "green", label: "Dietary energy", identifier: .dietaryEnergyConsumed, unit: .kilocalorie(), aggregation: .sum, tone: "amber", format: { "\(integer($0)) kcal" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Carbohydrate", identifier: .dietaryCarbohydrates, unit: .gram(), aggregation: .sum, tone: nil, format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Protein", identifier: .dietaryProtein, unit: .gram(), aggregation: .sum, tone: "amber", format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Total fat", identifier: .dietaryFatTotal, unit: .gram(), aggregation: .sum, tone: nil, format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Saturated fat", identifier: .dietaryFatSaturated, unit: .gram(), aggregation: .sum, tone: nil, format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Fibre", identifier: .dietaryFiber, unit: .gram(), aggregation: .sum, tone: "amber", format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Sugar", identifier: .dietarySugar, unit: .gram(), aggregation: .sum, tone: nil, format: { "\(oneDecimal($0)) g" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Sodium", identifier: .dietarySodium, unit: .gramUnit(with: .milli), aggregation: .sum, tone: nil, format: { "\(integer($0)) mg" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Potassium", identifier: .dietaryPotassium, unit: .gramUnit(with: .milli), aggregation: .sum, tone: nil, format: { "\(integer($0)) mg" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Dietary cholesterol", identifier: .dietaryCholesterol, unit: .gramUnit(with: .milli), aggregation: .sum, tone: nil, format: { "\(integer($0)) mg" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Water", identifier: .dietaryWater, unit: .literUnit(with: .milli), aggregation: .sum, tone: nil, format: { "\(integer($0)) ml" }),
            .init(category: "Nutrition", categoryTone: "green", label: "Caffeine", identifier: .dietaryCaffeine, unit: .gramUnit(with: .milli), aggregation: .sum, tone: nil, format: { "\(integer($0)) mg" }),
        ]
    }

    private func buildSnapshot(for target: HealthTargetContext, descriptors: [QuantityMetricDescriptor], calendar: Calendar) async throws -> DashboardHealthSnapshot {
        let date = target.targetDate
        let end = calendar.date(byAdding: .day, value: 1, to: date)!
        let weeklyStart = calendar.date(byAdding: .day, value: -6, to: date)!
        let monthlyStart = calendar.date(byAdding: .day, value: -29, to: date)!
        var grouped: [String: [DashboardHealthMetric]] = [:]
        var tones: [String: String] = [:]

        for descriptor in descriptors {
            guard let type = HKQuantityType.quantityType(forIdentifier: descriptor.identifier) else { continue }
            let day = try await statistics(for: type, start: date, end: end, descriptor: descriptor)
            guard let day else { continue }
            let week = try await statistics(for: type, start: weeklyStart, end: end, descriptor: descriptor)
            let month = try await statistics(for: type, start: monthlyStart, end: end, descriptor: descriptor)
            let monthlyHistory = try await dailyHistory(for: type, start: monthlyStart, end: date, calendar: calendar, descriptor: descriptor)
            let weeklyKey = Self.machineDayFormatter.string(from: weeklyStart)
            let weeklyHistory = monthlyHistory.filter { $0.date >= weeklyKey }
            let metric = makeMetric(
                descriptor: descriptor,
                day: day,
                week: week,
                month: month,
                date: date,
                weeklyHistory: weeklyHistory,
                monthlyHistory: monthlyHistory
            )
            grouped[descriptor.category, default: []].append(metric)
            tones[descriptor.category] = descriptor.categoryTone
        }

        let sleepMetrics = try await sleepMetrics(for: date, calendar: calendar)
        if !sleepMetrics.isEmpty {
            grouped["Sleep"] = sleepMetrics
            tones["Sleep"] = "blue"
        }

        let order = ["Activity", "Sleep", "Heart", "Respiratory", "Mobility", "Nutrition"]
        let dateText = Self.dayFormatter.string(from: date)
        let categories = order.compactMap { name -> DashboardHealthCategory? in
            guard let metrics = grouped[name], !metrics.isEmpty else { return nil }
            return DashboardHealthCategory(
                name: name,
                note: "Apple Health · \(dateText) · 7-day and 30-day comparisons",
                tone: tones[name] ?? "blue",
                metrics: metrics
            )
        }

        return DashboardHealthSnapshot(
            status: categories.count == order.count ? "live" : "partial",
            dataDate: Self.machineDayFormatter.string(from: date),
            targetDate: target.targetDateKey,
            targetPolicy: target.policy.rawValue,
            targetLabel: target.label,
            requiredThrough: target.targetDateKey,
            eligibleThrough: target.targetDateKey,
            capturedAt: ISO8601DateFormatter().string(from: Date()),
            message: "Operational-day HealthKit aggregates synced privately from the iPhone using \(target.label).",
            categories: categories,
            sources: [DashboardHealthSource(
                source: "Apple Health / HealthKit",
                status: "Synced",
                detail: "Operational-day aggregates for \(dateText), with 7-day and 30-day baselines. Raw samples stay on the iPhone.",
                tone: "green"
            )],
            actions: [
                DashboardHealthAction(tone: "green", title: "Operational Health day is synced", text: "Review the direction indicators against both baselines before interpreting an isolated daily value."),
                DashboardHealthAction(tone: "blue", title: "Use trends, not one reading", text: "HealthKit values are wellness signals. Repeated changes and symptoms matter more than a single high or low observation."),
                DashboardHealthAction(tone: "amber", title: "Treat nutrition as logged intake", text: "Nutrition aggregates reflect recorded entries and may not represent total food or fluid consumption."),
            ]
        )
    }

    private struct StatisticValues {
        let primary: Double
        let minimum: Double?
        let maximum: Double?
        let days: Int
    }

    private func statistics(for type: HKQuantityType, start: Date, end: Date, descriptor: QuantityMetricDescriptor) async throws -> StatisticValues? {
        let options: HKStatisticsOptions
        switch descriptor.aggregation {
        case .sum: options = .cumulativeSum
        case .average: options = .discreteAverage
        case .range: options = [.discreteMin, .discreteMax, .discreteAverage]
        }
        let stats = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HKStatistics, Error>) in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
            let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: options) { _, statistics, error in
                if let error { continuation.resume(throwing: error) }
                else if let statistics { continuation.resume(returning: statistics) }
                else { continuation.resume(throwing: CocoaError(.fileReadUnknown)) }
            }
            healthStore.execute(query)
        }
        let days = max(1, Calendar.autoupdatingCurrent.dateComponents([.day], from: start, to: end).day ?? 1)
        switch descriptor.aggregation {
        case .sum:
            guard let value = stats.sumQuantity()?.doubleValue(for: descriptor.unit) else { return nil }
            return StatisticValues(primary: value / Double(days), minimum: nil, maximum: nil, days: days)
        case .average:
            guard let value = stats.averageQuantity()?.doubleValue(for: descriptor.unit) else { return nil }
            return StatisticValues(primary: value, minimum: nil, maximum: nil, days: days)
        case .range:
            guard let minimum = stats.minimumQuantity()?.doubleValue(for: descriptor.unit),
                  let maximum = stats.maximumQuantity()?.doubleValue(for: descriptor.unit) else { return nil }
            let average = stats.averageQuantity()?.doubleValue(for: descriptor.unit) ?? ((minimum + maximum) / 2)
            return StatisticValues(primary: average, minimum: minimum, maximum: maximum, days: days)
        }
    }

    private func makeMetric(
        descriptor: QuantityMetricDescriptor,
        day: StatisticValues,
        week: StatisticValues?,
        month: StatisticValues?,
        date: Date,
        weeklyHistory: [DashboardHealthHistoryPoint],
        monthlyHistory: [DashboardHealthHistoryPoint]
    ) -> DashboardHealthMetric {
        let display: (StatisticValues) -> String = { values in
            if let minimum = values.minimum, let maximum = values.maximum {
                return "\(descriptor.format(minimum))–\(descriptor.format(maximum))"
            }
            return descriptor.format(values.primary)
        }
        let average: (StatisticValues?) -> DashboardHealthAverage? = { baseline in
            guard let baseline, baseline.primary != 0 else { return nil }
            let change = ((day.primary - baseline.primary) / abs(baseline.primary)) * 100
            let direction = abs(change) < 1 ? "same" : change > 0 ? "up" : "down"
            return DashboardHealthAverage(value: display(baseline), direction: direction, delta: String(format: "%+.1f%%", change))
        }
        var averages: [String: DashboardHealthAverage] = [:]
        if let weekly = average(week) { averages["weekly"] = weekly }
        if let monthly = average(month) { averages["monthly"] = monthly }
        var history: [String: [DashboardHealthHistoryPoint]] = [:]
        if !weeklyHistory.isEmpty { history["weekly"] = weeklyHistory }
        if !monthlyHistory.isEmpty { history["monthly"] = monthlyHistory }
        return DashboardHealthMetric(
            label: descriptor.label,
            value: display(day),
            context: "Apple Health · \(Self.dayFormatter.string(from: date))",
            tone: descriptor.tone,
            averages: averages,
            history: history
        )
    }

    private func sleepMetrics(for date: Date, calendar: Calendar) async throws -> [DashboardHealthMetric] {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
        let end = calendar.date(byAdding: .day, value: 1, to: date)!
        let weekStart = calendar.date(byAdding: .day, value: -6, to: date)!
        let monthStart = calendar.date(byAdding: .day, value: -29, to: date)!
        let definitions: [(String, Set<Int>)] = [
            ("Time asleep", [HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue, HKCategoryValueSleepAnalysis.asleepCore.rawValue, HKCategoryValueSleepAnalysis.asleepDeep.rawValue, HKCategoryValueSleepAnalysis.asleepREM.rawValue]),
            ("Deep sleep", [HKCategoryValueSleepAnalysis.asleepDeep.rawValue]),
            ("REM sleep", [HKCategoryValueSleepAnalysis.asleepREM.rawValue]),
            ("Core sleep", [HKCategoryValueSleepAnalysis.asleepCore.rawValue]),
            ("Awake", [HKCategoryValueSleepAnalysis.awake.rawValue]),
        ]
        let overlapAllowance: TimeInterval = 12 * 60 * 60
        let daySamples = try await categorySamples(type: type, start: date.addingTimeInterval(-overlapAllowance), end: end)
        let weekSamples = try await categorySamples(type: type, start: weekStart.addingTimeInterval(-overlapAllowance), end: end)
        let monthSamples = try await categorySamples(type: type, start: monthStart.addingTimeInterval(-overlapAllowance), end: end)
        return definitions.compactMap { label, values in
            let day = duration(of: values, in: daySamples, windowStart: date, windowEnd: end)
            guard day > 0 else { return nil }
            let week = duration(of: values, in: weekSamples, windowStart: weekStart, windowEnd: end) / 7
            let month = duration(of: values, in: monthSamples, windowStart: monthStart, windowEnd: end) / 30
            let monthlyHistory = sleepDailyHistory(of: values, in: monthSamples, start: monthStart, end: end, calendar: calendar)
            let weeklyKey = Self.machineDayFormatter.string(from: weekStart)
            let weeklyHistory = monthlyHistory.filter { $0.date >= weeklyKey }
            return durationMetric(label: label, day: day, week: week, month: month, date: date, weeklyHistory: weeklyHistory, monthlyHistory: monthlyHistory)
        }
    }

    private func categorySamples(type: HKCategoryType, start: Date, end: Date) async throws -> [HKCategorySample] {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: (samples as? [HKCategorySample]) ?? []) }
            }
            healthStore.execute(query)
        }
    }

    private func duration(
        of values: Set<Int>,
        in samples: [HKCategorySample],
        windowStart: Date,
        windowEnd: Date
    ) -> TimeInterval {
        samples.filter { values.contains($0.value) }.reduce(0) { total, sample in
            let clippedStart = max(sample.startDate, windowStart)
            let clippedEnd = min(sample.endDate, windowEnd)
            return total + max(0, clippedEnd.timeIntervalSince(clippedStart))
        }
    }

    private func durationMetric(
        label: String,
        day: TimeInterval,
        week: TimeInterval,
        month: TimeInterval,
        date: Date,
        weeklyHistory: [DashboardHealthHistoryPoint],
        monthlyHistory: [DashboardHealthHistoryPoint]
    ) -> DashboardHealthMetric {
        let format: (TimeInterval) -> String = { duration in
            let minutes = Int((duration / 60).rounded())
            return "\(minutes / 60)h \(String(format: "%02d", minutes % 60))m"
        }
        let average: (TimeInterval) -> DashboardHealthAverage? = { baseline in
            guard baseline > 0 else { return nil }
            let change = ((day - baseline) / baseline) * 100
            return DashboardHealthAverage(value: format(baseline), direction: abs(change) < 1 ? "same" : change > 0 ? "up" : "down", delta: String(format: "%+.1f%%", change))
        }
        var averages: [String: DashboardHealthAverage] = [:]
        if let value = average(week) { averages["weekly"] = value }
        if let value = average(month) { averages["monthly"] = value }
        var history: [String: [DashboardHealthHistoryPoint]] = [:]
        if !weeklyHistory.isEmpty { history["weekly"] = weeklyHistory }
        if !monthlyHistory.isEmpty { history["monthly"] = monthlyHistory }
        return DashboardHealthMetric(label: label, value: format(day), context: "Apple Health · \(Self.dayFormatter.string(from: date))", tone: label == "Time asleep" ? "blue" : nil, averages: averages, history: history)
    }

    private func dailyHistory(
        for type: HKQuantityType,
        start: Date,
        end: Date,
        calendar: Calendar,
        descriptor: QuantityMetricDescriptor
    ) async throws -> [DashboardHealthHistoryPoint] {
        switch descriptor.aggregation {
        case .range:
            return []
        case .sum, .average:
            break
        }
        let dayStart = calendar.startOfDay(for: start)
        let queryEnd = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: end))!
        let options: HKStatisticsOptions = descriptor.aggregation == .sum ? .cumulativeSum : .discreteAverage
        let collection = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<HKStatisticsCollection, Error>) in
            let predicate = HKQuery.predicateForSamples(withStart: dayStart, end: queryEnd, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: options,
                anchorDate: dayStart,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, statistics, error in
                if let error { continuation.resume(throwing: error) }
                else if let statistics { continuation.resume(returning: statistics) }
                else { continuation.resume(throwing: CocoaError(.fileReadUnknown)) }
            }
            healthStore.execute(query)
        }
        var points: [DashboardHealthHistoryPoint] = []
        collection.enumerateStatistics(from: dayStart, to: queryEnd) { stats, _ in
            let raw: Double?
            switch descriptor.aggregation {
            case .sum:
                raw = stats.sumQuantity()?.doubleValue(for: descriptor.unit)
            case .average:
                raw = stats.averageQuantity()?.doubleValue(for: descriptor.unit)
            case .range:
                raw = nil
            }
            guard let raw, stats.startDate < queryEnd else { return }
            points.append(DashboardHealthHistoryPoint(date: Self.machineDayFormatter.string(from: stats.startDate), value: raw))
        }
        return points
    }

    private func sleepDailyHistory(
        of values: Set<Int>,
        in samples: [HKCategorySample],
        start: Date,
        end: Date,
        calendar: Calendar
    ) -> [DashboardHealthHistoryPoint] {
        var points: [DashboardHealthHistoryPoint] = []
        var day = calendar.startOfDay(for: start)
        let last = calendar.startOfDay(for: end)
        while day <= last {
            let next = calendar.date(byAdding: .day, value: 1, to: day)!
            let seconds = duration(of: values, in: samples, windowStart: day, windowEnd: next)
            if seconds > 0 {
                points.append(DashboardHealthHistoryPoint(date: Self.machineDayFormatter.string(from: day), value: seconds / 3600))
            }
            day = next
        }
        return points
    }

    private func upload(_ snapshot: DashboardHealthSnapshot, to dashboardURL: URL) async throws {
        guard var components = URLComponents(url: dashboardURL, resolvingAgainstBaseURL: false) else { throw URLError(.badURL) }
        components.path = "/_health/snapshot"
        components.query = nil
        guard let endpoint = components.url else { throw URLError(.badURL) }
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let healthToken = try HealthCredentialStore.token()
        request.setValue("Bearer \(healthToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(snapshot)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw URLError(.badServerResponse) }
    }

    private static let machineDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}
#endif
