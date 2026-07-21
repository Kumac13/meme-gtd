import Foundation

enum TemplateCreationTarget: String {
    case task
    case article

    var blankLabel: String {
        switch self {
        case .task: "Blank task"
        case .article: "Blank article"
        }
    }
}

/// Blank／Template 選択後に全作成フォームへ渡す共通初期値。
/// Templateモデルからの適用規則はここだけが所有する。
struct IssueCreationDefaults: Equatable {
    let bodyMd: String
    let labelNames: [String]
    let projectIds: [Int]

    static let blank = IssueCreationDefaults(bodyMd: "", labelNames: [], projectIds: [])

    init(bodyMd: String, labelNames: [String], projectIds: [Int]) {
        self.bodyMd = bodyMd
        self.labelNames = labelNames
        self.projectIds = projectIds
    }

    init(template: Template) {
        self.init(
            bodyMd: template.bodyMd,
            labelNames: template.labels ?? [],
            projectIds: template.projectIds ?? []
        )
    }
}
