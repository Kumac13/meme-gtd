import SwiftUI

struct DateRangePreset: Identifiable {
    let id = UUID()
    let label: String
    let from: Date
    let to: Date
}

struct DateRangePickerModal: View {
    @Binding var dateFrom: Date?
    @Binding var dateTo: Date?
    let onDismiss: () -> Void

    @State private var customFrom: Date = Date()
    @State private var customTo: Date = Date()
    @State private var showCustomFrom = false
    @State private var showCustomTo = false

    private var presets: [DateRangePreset] {
        let cal = Calendar.current
        let now = Date()
        let thisYear = cal.component(.year, from: now)

        let lastYearStart = cal.date(from: DateComponents(year: thisYear - 1, month: 1, day: 1))!
        let lastYearEnd = cal.date(from: DateComponents(year: thisYear - 1, month: 12, day: 31))!
        let thisYearStart = cal.date(from: DateComponents(year: thisYear, month: 1, day: 1))!
        let thisYearEnd = cal.date(from: DateComponents(year: thisYear, month: 12, day: 31))!

        let thisMonth = cal.component(.month, from: now)
        let lastMonthComps: DateComponents = {
            if thisMonth == 1 {
                return DateComponents(year: thisYear - 1, month: 12, day: 1)
            }
            return DateComponents(year: thisYear, month: thisMonth - 1, day: 1)
        }()
        let lastMonthStart = cal.date(from: lastMonthComps)!
        let lastMonthEnd = cal.date(byAdding: DateComponents(month: 1, day: -1), to: lastMonthStart)!

        let thisMonthStart = cal.date(from: DateComponents(year: thisYear, month: thisMonth, day: 1))!
        let thisMonthEnd = cal.date(byAdding: DateComponents(month: 1, day: -1), to: thisMonthStart)!

        return [
            DateRangePreset(label: "Last Year", from: lastYearStart, to: lastYearEnd),
            DateRangePreset(label: "This Year", from: thisYearStart, to: thisYearEnd),
            DateRangePreset(label: "Last Month", from: lastMonthStart, to: lastMonthEnd),
            DateRangePreset(label: "This Month", from: thisMonthStart, to: thisMonthEnd),
        ]
    }

    private var isActive: Bool {
        dateFrom != nil || dateTo != nil
    }

    private func isPresetActive(_ preset: DateRangePreset) -> Bool {
        guard let from = dateFrom, let to = dateTo else { return false }
        return Calendar.current.isDate(from, inSameDayAs: preset.from)
            && Calendar.current.isDate(to, inSameDayAs: preset.to)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Button(action: { HapticManager.impact(.light); onDismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 28))
                        .symbolRenderingMode(.hierarchical)
                        .foregroundColor(Color(.tertiaryLabel))
                }
                Spacer()
                Text("Schedule")
                    .font(.system(size: 17, weight: .semibold))
                Spacer()
                Button(action: {
                    HapticManager.impact(.light)
                    dateFrom = nil
                    dateTo = nil
                }) {
                    Text("Clear")
                        .font(.system(size: 16))
                        .foregroundColor(isActive ? .accent : Color(.systemGray3))
                }
                .disabled(!isActive)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Presets
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Presets")
                            .font(.system(size: 13))
                            .foregroundColor(Color(.secondaryLabel))
                            .padding(.horizontal, 4)

                        FlowLayout(spacing: 8) {
                            ForEach(presets) { preset in
                                Button(action: {
                                    HapticManager.impact(.light)
                                    dateFrom = preset.from
                                    dateTo = preset.to
                                    customFrom = preset.from
                                    customTo = preset.to
                                }) {
                                    Text(preset.label)
                                        .font(.system(size: 14, weight: .medium))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(isPresetActive(preset) ? Color.accent : Color(.systemGray5))
                                        .foregroundColor(isPresetActive(preset) ? .white : .textPrimary)
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    Divider()

                    // Custom range
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Custom Range")
                            .font(.system(size: 13))
                            .foregroundColor(Color(.secondaryLabel))
                            .padding(.horizontal, 4)

                        // From date
                        VStack(alignment: .leading, spacing: 4) {
                            Text("From")
                                .font(.system(size: 13))
                                .foregroundColor(Color(.secondaryLabel))

                            DatePicker(
                                "",
                                selection: $customFrom,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .onChange(of: customFrom) { _, newValue in
                                dateFrom = newValue
                            }
                        }

                        // To date
                        VStack(alignment: .leading, spacing: 4) {
                            Text("To")
                                .font(.system(size: 13))
                                .foregroundColor(Color(.secondaryLabel))

                            DatePicker(
                                "",
                                selection: $customTo,
                                in: customFrom...,
                                displayedComponents: .date
                            )
                            .datePickerStyle(.compact)
                            .labelsHidden()
                            .onChange(of: customTo) { _, newValue in
                                dateTo = newValue
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Color(.systemBackground))
        .onAppear {
            if let from = dateFrom { customFrom = from }
            if let to = dateTo { customTo = to }
        }
    }
}
