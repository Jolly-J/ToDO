/**
 * 附件下载工具函数
 * 统一处理任务附件和评论附件的下载逻辑，自动携带认证 token
 */

export type AttachmentSource = 'task' | 'comment';

export function getAttachmentDownloadPath(
  attachmentId: string,
  source: AttachmentSource = 'task',
) {
  return source === 'comment'
    ? `/api/attachments/comment-attachments/${attachmentId}/download`
    : `/api/attachments/${attachmentId}/download`;
}

export async function fetchAttachmentBlob(
  attachmentId: string,
  source: AttachmentSource = 'task',
): Promise<Blob> {
  const token = localStorage.getItem('token');
  const response = await fetch(getAttachmentDownloadPath(attachmentId, source), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

/**
 * 下载附件
 * @param attachmentId 附件 ID
 * @param filename 原始文件名
 * @param source 附件来源，task 对应任务附件，comment 对应评论附件
 */
export async function downloadAttachment(
  attachmentId: string,
  filename: string,
  source: AttachmentSource = 'task',
): Promise<void> {
  const blob = await fetchAttachmentBlob(attachmentId, source);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
