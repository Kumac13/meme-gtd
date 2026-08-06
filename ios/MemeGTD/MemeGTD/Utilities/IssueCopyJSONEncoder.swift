import Foundation

/// JSON representation shared by Task and Memo "Copy All Contents with JSON".
/// The envelope matches Web so every item field and every comment timestamp is
/// preserved without flattening unrelated records together.
enum IssueCopyJSONEncoder {
    private struct Payload<Item: Encodable>: Encodable {
        let item: Item
        let comments: [Comment]
    }

    static func string<Item: Encodable>(item: Item, comments: [Comment]) -> String? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]

        guard let data = try? encoder.encode(Payload(item: item, comments: comments)) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }
}
