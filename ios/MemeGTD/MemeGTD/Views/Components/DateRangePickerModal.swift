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
    @State private var expandedPicker: PickerField? = nil

    private enum PickerField { case from, to }

    private var presets: [DateRangePreset] {
        let cal = Calendar.current
        let now = Date()
        let thisYear = cal.component(.year, from: now)
        let thisMonth = cal.component(.month, from: now)

        let todayStart = cal.startOfDay(for: now)
        let todayEnd = todayStart

        let yesterdayStart = cal.date(byAdding: .day, value: -1, to: todayStart)!
        let yesterdayEnd = yesterdayStart

        let weekday = cal.component(.weekday, from: now)
        let daysFromMonday = (weekday + 5) % 7
        let thisWeekStart = cal.date(byAdding: .day, value: -daysFromMonday, to: todayStart)!
        let thisWeekEnd = cal.date(byAdding: .day, value: 6, to: thisWeekStart)!

        let lastWeekStart = cal.date(byAdding: .day, value: -7, to: thisWeekStart)!
        let lastWeekEnd = cal.date(byAdding: .day, value: -1, to: thisWeekStart)!

        let thisMonthStart = cal.date(from: DateComponents(year: thisYear, month: thisMonth, day: 1))!
        let thisMonthEnd = cal.date(byAdding: DateComponents(month: 1, day: -1), to: thisMonthStart)!

        let lastMonthComps: DateComponents = {
            if thisMonth == 1 {
                return DateComponents(year: thisYear - 1, month: 12, day: 1)
            }
            return DateComponents(year: thisYear, month: thisMonth - 1, day: 1)
        }()
        let lastMonthStart = cal.date(from: lastMonthComps)!
        let lastMonthEnd = cal.date(byAdding: DateComponents(month: 1, day: -1), to: lastMonthStart)!

        let thisYearStart = cal.date(from: DateComponents(year: thisYear, month: 1, day: 1))!
        let thisYearEnd = cal.date(from: DateComponents(year: thisYear, month: 12, day: 31))!

        let lastYearStart = cal.date(from: DateComponents(year: thisYear - 1, month: 1, day: 1))!
        let lastYearEnd = cal.date(from: DateComponents(year: thisYear - 1, month: 12, day: 31))!

        return [
            DateRangePreset(label: "Today", from: todayStart, to: todayEnd),
            DateRangePreset(label: "Yesterday", from: yesterdayStart, to: yesterdayEnd),
            DateRangePreset(label: "This Week", from: thisWeekStart, to: thisWeekEnd),
            DateRangePreset(label: "Last Week", from: lastWeekStart, to: lastWeekEnd),
            DateRangePreset(label: "This Month", from: thisMonthStart, to: thisMonthEnd),
            DateRangePreset(label: "Last Month", from: lastMonthStart, to: lastMonthEnd),
            DateRangePreset(label: "This Year", from: thisYearStart, to: thisYearEnd),
            DateRangePreset(label: "Last Year", from: lastYearStart, to: lastYearEnd),
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

                    // Custom range with expandable wheel pickers
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Custom Range")
                            .font(.system(size: 13))
                            .foregroundColor(Color(.secondaryLabel))
                            .padding(.horizontal, 4)
                            .padding(.bottom, 8)

                        // From row
                        Button(action: {
                            HapticManager.impact(.light)
                            withAnimation(.easeInOut(duration: 0.25)) {
                                expandedPicker = expandedPicker == .from ? nil : .from
                            }
                        }) {
                            HStack {
                                Text("From")
                                    .font(.system(size: 15))
                                    .foregroundColor(Color(.label))
                                Spacer()
                                Text(DateFilterHelpers.shortDate(customFrom))
                                    .font(.system(size: 15, weight: dateFrom != nil ? .semibold : .regular))
                                    .foregroundColor(dateFrom != nil ? .accent : Color(.secondaryLabel))
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(.tertiaryLabel))
                                    .rotationEffect(.degrees(expandedPicker == .from ? -180 : 0))
                            }
                            .padding(.vertical, 12)
                        }

                        if expandedPicker == .from {
                            VStack(spacing: 8) {
                                DatePicker(
                                    "",
                                    selection: $customFrom,
                                    displayedComponents: .date
                                )
                                .datePickerStyle(.wheel)
                                .labelsHidden()
                                .frame(maxWidth: .infinity, maxHeight: 150)
                                .clipped()
                                .onChange(of: customFrom) { _, newValue in
                                    dateFrom = newValue
                                }

                                Button(action: {
                                    HapticManager.impact(.light)
                                    withAnimation(.easeInOut(duration: 0.25)) {
                                        expandedPicker = nil
                                    }
                                }) {
                                    Text("Done")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundColor(.accent)
                                }
                                .padding(.bottom, 4)
                            }
                        }

                        Divider()

                        // To row
                        Button(action: {
                            HapticManager.impact(.light)
                            withAnimation(.easeInOut(duration: 0.25)) {
                                expandedPicker = expandedPicker == .to ? nil : .to
                            }
                        }) {
                            HStack {
                                Text("To")
                                    .font(.system(size: 15))
                                    .foregroundColor(Color(.label))
                                Spacer()
                                Text(DateFilterHelpers.shortDate(customTo))
                                    .font(.system(size: 15, weight: dateTo != nil ? .semibold : .regular))
                                    .foregroundColor(dateTo != nil ? .accent : Color(.secondaryLabel))
                                Image(systemName: "chevron.down")
                                    .font(.system(size: 12))
                                    .foregroundColor(Color(.tertiaryLabel))
                                    .rotationEffect(.degrees(expandedPicker == .to ? -180 : 0))
                            }
                            .padding(.vertical, 12)
                        }

                        if expandedPicker == .to {
                            VStack(spacing: 8) {
                                DatePicker(
                                    "",
                                    selection: $customTo,
                                    in: customFrom...,
                                    displayedComponents: .date
                                )
                                .datePickerStyle(.wheel)
                                .labelsHidden()
                                .frame(maxWidth: .infinity, maxHeight: 150)
                                .clipped()
                                .onChange(of: customTo) { _, newValue in
                                    dateTo = newValue
                                }

                                Button(action: {
                                    HapticManager.impact(.light)
                                    withAnimation(.easeInOut(duration: 0.25)) {
                                        expandedPicker = nil
                                    }
                                }) {
                                    Text("Done")
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundColor(.accent)
                                }
                                .padding(.bottom, 4)
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
