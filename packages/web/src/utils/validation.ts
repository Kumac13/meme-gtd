/**
 * Form validation utilities for meme-gtd Web UI
 */

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate memo body
 * @param body Memo body to validate
 * @returns Validation result
 */
export function validateMemoBody(body: string): { isValid: boolean; error?: string } {
  // Body can be empty (optional)
  if (body.length > 10000) {
    return { isValid: false, error: 'Body must be 10,000 characters or less' };
  }
  return { isValid: true };
}

/**
 * Validate task title
 * @param title Task title to validate
 * @returns Validation result
 */
function validateTaskTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: 'Title is required' };
  }
  if (title.length > 200) {
    return { isValid: false, error: 'Title must be 200 characters or less' };
  }
  return { isValid: true };
}

/**
 * Validate task body
 * @param body Task body to validate (can be empty for GTD quick capture)
 * @returns Validation result
 */
function validateTaskBody(body: string): { isValid: boolean; error?: string } {
  // Body can be empty (optional for quick capture)
  if (body.length > 10000) {
    return { isValid: false, error: 'Body must be 10,000 characters or less' };
  }
  return { isValid: true };
}

/**
 * Validate task status
 * @param status Task status to validate
 * @returns Validation result
 */
function validateTaskStatus(status: string): { isValid: boolean; error?: string } {
  const validStatuses = ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];
  if (!validStatuses.includes(status)) {
    return { isValid: false, error: `Status must be one of: ${validStatuses.join(', ')}` };
  }
  return { isValid: true };
}

/**
 * Validate entire task form
 * @param title Task title
 * @param body Task body
 * @param status Task status
 * @returns Validation result with all errors
 */
export function validateTaskForm(title: string, body: string, status: string): ValidationResult {
  const errors: Record<string, string> = {};

  const titleResult = validateTaskTitle(title);
  if (!titleResult.isValid && titleResult.error) {
    errors.title = titleResult.error;
  }

  const bodyResult = validateTaskBody(body);
  if (!bodyResult.isValid && bodyResult.error) {
    errors.body = bodyResult.error;
  }

  const statusResult = validateTaskStatus(status);
  if (!statusResult.isValid && statusResult.error) {
    errors.status = statusResult.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
