import SwiftUI

struct ActivityItemView: View {
    let activity: ActivityLogEntry
    var issueId: Int?

    var isLast = false
    @EnvironmentObject private var dataSources: DataSourceProvider
    @State private var memoPreview: String?

    var body: some View {
        Group {
            if activity.eventType == "link.created" || activity.eventType == "link.deleted" {
                linkRow
            } else {
                compactRow
            }
        }
        .background(alignment: .topLeading) {
            Rectangle().fill(Color(.systemGray3))
                .frame(width: 2)
                .frame(height: isLast ? 12 : nil)
                .padding(.leading, 24)
        }
    }

    private var linkRow: some View {
        let payload = activity.payload
        let side = payload["source_issue_id"]?.intValue == issueId ? "target_issue_" : "source_issue_"
        let type = payload[side + "type"]?.stringValue
        let id = payload[side + "id"]?.intValue
        let snapshot = payload[side + "title"]?.stringValue
        let title = snapshot ?? memoPreview ?? ""
        return HStack(alignment: .top, spacing: 0) {
            Image(systemName: "link")
                .font(.system(size: 11)).foregroundStyle(.secondary)
                .frame(width: 18, height: 18).background(Color(.systemBackground), in: Circle())
                .frame(width: 50, height: 16)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(activity.eventType == "link.created" ? "Linked" : "Unlinked")
                    Spacer()
                    Text(TimelineHelpers.relativeTimeString(iso: activity.occurredAt))
                }.font(.system(size: 11)).foregroundStyle(.secondary)
                if let id {
                    let target = targetLabel(id: id, type: type, title: title)
                    switch IssueRouteDestination(id: id, type: type, title: title) {
                    case .memo(let route): NavigationLink(value: route) { target }
                    case .task(let route): NavigationLink(value: route) { target }
                    case .article(let route): NavigationLink(value: route) { target }
                    case .template(let route): NavigationLink(value: route) { target }
                    case nil: target
                    }
                }
            }.padding(.trailing, 16)
        }
        .buttonStyle(.plain)
        .padding(.vertical, 4)
        .task(id: id) {
            memoPreview = nil
            if type == "memo", snapshot == nil, let id,
               let memo = try? await dataSources.memos.getMemo(id: id), !Task.isCancelled {
                memoPreview = TargetIssue.memoPreview(memo.bodyMd)
            }
        }
    }

    private func targetLabel(id: Int, type: String?, title: String) -> some View {
        let symbol: String
        switch type {
        case "memo": symbol = "note.text"
        case "article": symbol = "newspaper"
        case "task": symbol = "checkmark.square"
        default: symbol = "doc"
        }
        return HStack(spacing: 7) {
            Image(systemName: symbol).foregroundStyle(Color.accentDark)
            Text(verbatim: "#\(id)").font(.caption.monospacedDigit()).fixedSize()
            Text(title).font(.system(size: 13, weight: .medium)).lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 9)
        .frame(height: 30)
        .foregroundStyle(Color.textPrimary)
        .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(Color.border))
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(type ?? "Item") #\(id) \(title)")
    }

    private var compactRow: some View {
        HStack(spacing: 0) {
            // Icon area: centered on the connector line (leading 24pt = center of 2pt line)
            Image(systemName: iconName)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color(.systemGray2))
                .frame(width: 48, alignment: .center)

            // Description
            descriptionView
                .lineLimit(1)

            Spacer(minLength: 4)

            // Timestamp
            Text(TimelineHelpers.relativeTimeString(iso: activity.occurredAt))
                .font(.system(size: 11))
                .foregroundColor(Color(.systemGray3))
                .padding(.trailing, 16)
        }
        .padding(.vertical, 6)
    }

    // MARK: - Icon

    private var iconName: String {
        switch activity.eventType {
        case "label.assigned": return "tag"
        case "label.removed": return "tag.slash"
        case "link.created": return "link"
        case "link.deleted": return "link"
        case "task.status_changed": return "arrow.triangle.2.circlepath"
        case "project.item_added": return "folder.badge.plus"
        case "project.item_removed": return "folder.badge.minus"
        default: return "circle"
        }
    }

    // MARK: - Description

    @ViewBuilder
    private var descriptionView: some View {
        let p = activity.payload
        switch activity.eventType {
        case "label.assigned":
            let name = p["label_name"]?.stringValue ?? "label"
            HStack(spacing: 4) {
                Text("added")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
                labelBadge(name)
                Text("label")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
            }
        case "label.removed":
            let name = p["label_name"]?.stringValue ?? "label"
            HStack(spacing: 4) {
                Text("removed")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
                labelBadge(name)
                Text("label")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
            }
        case "task.status_changed":
            let from = p["from_status"]?.stringValue ?? "?"
            let to = p["to_status"]?.stringValue ?? "?"
            Text("changed status \(from) \u{2192} \(to)")
                .font(.system(size: 12))
                .foregroundColor(Color(.systemGray))
        case "project.item_added":
            let name = p["project_name"]?.stringValue ?? "project"
            Text("added to \(name)")
                .font(.system(size: 12))
                .foregroundColor(Color(.systemGray))
        case "project.item_removed":
            let name = p["project_name"]?.stringValue ?? "project"
            Text("removed from \(name)")
                .font(.system(size: 12))
                .foregroundColor(Color(.systemGray))
        case "issue.transferred":
            Text("Transferred to Memo")
                .font(.system(size: 12))
                .foregroundColor(Color(.systemGray))
        default:
            Text(activity.eventType)
                .font(.system(size: 12))
                .foregroundColor(Color(.systemGray))
        }
    }

    // MARK: - Helpers

    private func labelBadge(_ name: String) -> some View {
        Text(name)
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(LabelColorHelper.textColor(for: name))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(LabelColorHelper.bgColor(for: name))
            .clipShape(Capsule())
    }

}
