import Foundation

enum TimelineDateBucket: String {
    case today = "Today"
    case yesterday = "Yesterday"
    case thisWeek = "This Week"
    case thisMonth = "This Month"
    case earlier = "Earlier"
}

struct TimelineHelpers {
    private static let hourInSeconds: TimeInterval = 60 * 60

    private static func startOfLocalDay(_ date: Date) -> Date {
        Calendar.current.startOfDay(for: date)
    }

    private static func startOfWeekMonday(_ date: Date) -> Date {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: date)
        // Sunday = 1, Monday = 2, ..., Saturday = 7
        let delta = weekday == 1 ? 6 : weekday - 2
        let dayStart = startOfLocalDay(date)
        return calendar.date(byAdding: .day, value: -delta, to: dayStart) ?? dayStart
    }

    static func getTimelineDateBucket(iso: String, now: Date = Date()) -> TimelineDateBucket {
        guard let target = ISO8601DateFormatter().date(from: iso) ?? parseFlexibleISO(iso) else {
            return .earlier
        }

        let targetDay = startOfLocalDay(target)
        let today = startOfLocalDay(now)

        if targetDay == today { return .today }
        if let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: today),
           targetDay == yesterday { return .yesterday }

        let weekStart = startOfWeekMonday(now)
        if targetDay >= weekStart { return .thisWeek }

        let monthStart = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: now))!
        if targetDay >= monthStart { return .thisMonth }

        return .earlier
    }

    static func shouldShowGapTimestamp(previousIso: String?, currentIso: String) -> Bool {
        guard let previousIso = previousIso else { return false }
        guard let previous = parseDate(previousIso),
              let current = parseDate(currentIso) else { return false }
        return abs(current.timeIntervalSince(previous)) >= hourInSeconds
    }

    static func formatTimelineTime(iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let now = Date()
        let calendar = Calendar.current

        let hours = String(format: "%02d", calendar.component(.hour, from: date))
        let minutes = String(format: "%02d", calendar.component(.minute, from: date))
        let timeText = "\(hours):\(minutes)"

        if calendar.isDate(date, inSameDayAs: now) {
            return timeText
        }

        let year = calendar.component(.year, from: date)
        let month = calendar.component(.month, from: date)
        let day = calendar.component(.day, from: date)
        return "\(year)/\(month)/\(day) \(timeText)"
    }

    static func relativeTimeString(iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 604800 { return "\(Int(interval / 86400))d ago" }

        let calendar = Calendar.current
        let month = calendar.component(.month, from: date)
        let day = calendar.component(.day, from: date)
        let year = calendar.component(.year, from: date)
        let nowYear = calendar.component(.year, from: now)
        if year == nowYear {
            return "\(month)/\(day)"
        }
        return "\(year)/\(month)/\(day)"
    }

    // MARK: - Date parsing

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parseDate(_ iso: String) -> Date? {
        isoFormatter.date(from: iso) ?? isoFormatterNoFraction.date(from: iso) ?? parseFlexibleISO(iso)
    }

    private static func parseFlexibleISO(_ iso: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        if let date = formatter.date(from: iso) { return date }
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return formatter.date(from: iso)
    }
}
