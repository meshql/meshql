import { FormEvent } from "react";

type PostFormProps = {
  title?: string;
  body?: string;
  status?: string;
  submitLabel: string;
  onSubmit: (data: { title: string; body: string; status: string }) => Promise<void>;
  onCancel?: () => void;
};

export function PostForm({
  title = "",
  body = "",
  status = "draft",
  submitLabel,
  onSubmit,
  onCancel,
}: PostFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    await onSubmit({
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      status: String(fd.get("status") ?? "draft"),
    });
  }

  return (
    <>
      <form className="crud-form" onSubmit={handleSubmit}>
        <label>
          Title
          <input type="text" name="title" required defaultValue={title} key={`title-${title}`} />
        </label>
        <label>
          Body
          <textarea name="body" required rows={4} defaultValue={body} key={`body-${body}`} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status} key={`status-${status}`}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="btn primary">
            {submitLabel}
          </button>
        </div>
      </form>
      {onCancel ? (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </>
  );
}
