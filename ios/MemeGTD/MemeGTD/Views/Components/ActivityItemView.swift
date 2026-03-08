import SwiftUI

struct ActivityItemView: View {
    let activity: ActivityLogEntry
    var issueId: Int?

    var body: some View {
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
        case "link.deleted": return "link.badge.minus"
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
        case "link.created":
            let sourceId = p["source_issue_id"]?.intValue
            let isSource = issueId != nil && sourceId == issueId
            let otherId = isSource ? p["target_issue_id"]?.intValue : p["source_issue_id"]?.intValue
            let otherTitle = isSource ? p["target_issue_title"]?.stringValue : p["source_issue_title"]?.stringValue
            let otherType = isSource ? p["target_issue_type"]?.stringValue : p["source_issue_type"]?.stringValue
            HStack(spacing: 2) {
                Text("linked")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
                if let id = otherId {
                    issueLink(id: id, title: otherTitle, type: otherType)
                }
            }
        case "link.deleted":
            let delSourceId = p["source_issue_id"]?.intValue
            let delIsSource = issueId != nil && delSourceId == issueId
            let delOtherId = delIsSource ? p["target_issue_id"]?.intValue : p["source_issue_id"]?.intValue
            let delOtherTitle = delIsSource ? p["target_issue_title"]?.stringValue : p["source_issue_title"]?.stringValue
            let delOtherType = delIsSource ? p["target_issue_type"]?.stringValue : p["source_issue_type"]?.stringValue
            HStack(spacing: 2) {
                Text("unlinked")
                    .font(.system(size: 12))
                    .foregroundColor(Color(.systemGray))
                if let id = delOtherId {
                    issueLink(id: id, title: delOtherTitle, type: delOtherType)
                }
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

    @ViewBuilder
    private func issueLink(id: Int, title: String?, type: String?) -> some View {
        let label = title != nil ? "#\(id) \(title!)" : "#\(id)"
        if type == "memo" {
            NavigationLink(value: MemoRoute(memoId: id, initialBody: title ?? "")) {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundColor(.accentColor)
            }
        } else {
            NavigationLink(value: TaskRoute(taskId: id, initialTitle: title ?? "")) {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundColor(.accentColor)
            }
        }
    }

    private func linkText(id: Int?, title: String?) -> String {
        if let title = title, let id = id {
            return "#\(id) \(title)"
        }
        if let id = id {
            return "#\(id)"
        }
        return ""
    }
}
