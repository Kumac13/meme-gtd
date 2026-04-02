import Foundation

struct DateFilterHelpers {
    private static let monthFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM"
        return fmt
    }()

    private static let monthYearFormatter: DateFormatter = {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM yyyy"
        return fmt
    }()

    /// Returns a display label for a date range filter pill.
    static func displayLabel(from: Date?, to: Date?, fallback: String = "Schedule") -> String {
        guard let from = from, let to = to else {
            if from != nil { return "From..." }
            if to != nil { return "To..." }
            return fallback
        }
        let cal = Calendar.current
        let fromYear = cal.component(.year, from: from)
        let toYear = cal.component(.year, from: to)
        let fromMonth = cal.component(.month, from: from)
        let toMonth = cal.component(.month, from: to)
        if fromYear == toYear {
            if fromMonth == 1 && toMonth == 12 {
                return "\(fromYear)"
            }
            if fromMonth == toMonth {
                return "\(monthFormatter.string(from: from)) \(fromYear)"
            }
            return "\(monthFormatter.string(from: from)) - \(monthFormatter.string(from: to))"
        }
        return "\(monthYearFormatter.string(from: from)) - \(monthYearFormatter.string(from: to))"
    }
}
