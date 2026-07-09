import XCTest
import UIKit
@testable import MemeGTD

/// Renders the article body to a PNG (written into the App Group container so it
/// can be pulled off the simulator) and asserts the highlight anchoring applied.
/// This catches layout regressions (e.g. text clipping) without app navigation.
@MainActor
final class ArticleBodyRenderTests: XCTestCase {
    func testRenderArticleBodyPNG() throws {
        let markdown = """
        # イギリス英語の世界へようこそ！私のイギリス英語学習法【書籍編】

        「動画編」を公開してから1ヶ月以上も経ってしまいましたが、**書籍を使用した勉強がしたい**という方も多いのではないかと思います。おすすめの書籍を目的別に紹介していきます。

        だからこそ書けるものだと自負しております！

        泣きたいほど素晴らしい本です🇬🇧

        - 発音がしっかり伝わっているところ。
        - 一つの音を丁寧に練習していきます。

        「手を動かすことで口も動かしやすくする」という考えに基づいているそうです。次第に口が馴染んで手の動きなしでも上手く発音できるようになっていきますが、まさにそのような感覚です。

        こだわりの**イギリス英語**にこだわっているところ。例文として Heathrow Airport が出てきたりします笑。
        """

        let highlights = [
            Highlight(
                id: 1, issueId: 2,
                exact: "書籍を使用した勉強がしたい",
                prefix: nil, suffix: nil, color: "green",
                createdAt: "", updatedAt: "", commentCount: 1
            ),
            Highlight(
                id: 2, issueId: 2,
                exact: "手を動かすことで口も動かしやすくする",
                prefix: nil, suffix: nil, color: "green",
                createdAt: "", updatedAt: "", commentCount: 0
            ),
        ]

        let attributed = ArticleBodyRenderer.makeAttributed(
            markdown: markdown,
            fontSize: 15,
            textColor: UIColor.label.withAlphaComponent(0.85),
            highlights: highlights,
            commentedHighlightIds: [1]
        )

        // Assertions: both highlights anchored, comment icon inserted for #1.
        let ns = attributed.string as NSString
        let r1 = ns.range(of: "書籍を使用した勉強がしたい")
        XCTAssertNotEqual(r1.location, NSNotFound)
        XCTAssertEqual(attributed.attribute(.mgtdHighlightId, at: r1.location, effectiveRange: nil) as? Int, 1)

        // Render to an image at a phone width and confirm the layout is sane.
        let width: CGFloat = 360
        let tv = UITextView()
        tv.isScrollEnabled = false
        tv.textContainerInset = .zero
        tv.textContainer.lineFragmentPadding = 0
        tv.backgroundColor = .white
        tv.attributedText = attributed
        let size = tv.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        tv.frame = CGRect(x: 0, y: 0, width: width, height: ceil(size.height))

        let window = UIWindow(frame: tv.frame)
        window.addSubview(tv)
        window.makeKeyAndVisible()
        tv.layoutIfNeeded()

        XCTAssertGreaterThan(size.height, 200, "body should have real height")
        XCTAssertLessThanOrEqual(tv.contentSize.width, width + 1, "text must wrap to width (no horizontal overflow)")

        let image = UIGraphicsImageRenderer(bounds: tv.bounds).image { ctx in
            tv.layer.render(in: ctx.cgContext)
        }
        guard let png = image.pngData() else {
            XCTFail("no png data"); return
        }

        if let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.memegtd.app"
        ) {
            let url = container.appendingPathComponent("article-render.png")
            try png.write(to: url)
            print("WROTE_RENDER_PNG: \(url.path)")
        } else {
            let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("article-render.png")
            try png.write(to: url)
            print("WROTE_RENDER_PNG_TMP: \(url.path)")
        }
    }
}
