import React from "react";
import { useParams } from "react-router-dom";
import { MarkdownRenderer } from "../../components/Article/MarkdownRenderer";
// import { LabelPicker } from "../../components/LabelPicker";
// import { LinkManager } from "../../components/LinkManager";
// import { CommentSection } from "../../components/CommentSection";

export const ArticleReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto p-4 flex gap-4">
      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-4">Article Reader {id}</h1>
        {/* TODO: Fetch article by ID */}
        <MarkdownRenderer content="Loading..." />
        <div className="mt-8 border-t pt-4">
            <h2 className="text-xl font-bold">Comments</h2>
            {/* <CommentSection issueId={Number(id)} /> */}
            <p>Comment section placeholder</p>
        </div>
      </div>
      <div className="w-64 border-l pl-4">
        <div className="mb-4">
            <h3 className="font-bold">Labels</h3>
            {/* <LabelPicker issueId={Number(id)} /> */}
            <p>Label picker placeholder</p>
        </div>
        <div>
            <h3 className="font-bold">Links</h3>
            {/* <LinkManager issueId={Number(id)} /> */}
            <p>Link manager placeholder</p>
        </div>
      </div>
    </div>
  );
};