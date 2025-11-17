/**
 * Form validation utilities for meme-gtd Web UI
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validate memo title
 * @param title Memo title to validate
 * @returns Validation result
 */
export function validateMemoTitle(title: string): { isValid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { isValid: false, error: 'Title is required' };
  }
  if (title.length > 200) {
    return { isValid: false, error: 'Title must be 200 characters or less' };
  }
  return { isValid: true };
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
export function validateTaskTitle(title: string): { isValid: boolean; error?: string } {
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
export function validateTaskBody(body: string): { isValid: boolean; error?: string } {
  // Body can be empty (optional for quick capture)
  if (body.length > 10000) {
    return { isValid: false, error: 'Body must be 10,000 characters or less' };
  }
  return { isValid: true };
}

/**
 * Validate label name
 * @param name Label name to validate
 * @returns Validation result
 */
export function validateLabelName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Label name is required' };
  }
  if (name.length > 50) {
    return { isValid: false, error: 'Label name must be 50 characters or less' };
  }
  // Label names should not contain special characters
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { isValid: false, error: 'Label name can only contain letters, numbers, hyphens, and underscores' };
  }
  return { isValid: true };
}

/**
 * Validate comment body
 * @param body Comment body to validate
 * @returns Validation result
 */
export function validateCommentBody(body: string): { isValid: boolean; error?: string } {
  if (!body || body.trim().length === 0) {
    return { isValid: false, error: 'Comment body is required' };
  }
  if (body.length > 5000) {
    return { isValid: false, error: 'Comment must be 5,000 characters or less' };
  }
  return { isValid: true };
}

/**
 * Validate task status
 * @param status Task status to validate
 * @returns Validation result
 */
export function validateTaskStatus(status: string): { isValid: boolean; error?: string } {
  const validStatuses = ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];
  if (!validStatuses.includes(status)) {
    return { isValid: false, error: `Status must be one of: ${validStatuses.join(', ')}` };
  }
  return { isValid: true };
}

/**
 * Validate link relationship type
 * @param relType Relationship type to validate
 * @returns Validation result
 */
export function validateLinkRelType(relType: string): { isValid: boolean; error?: string } {
  const validRelTypes = ['blocks', 'blocked_by', 'relates_to', 'parent_of', 'child_of', 'duplicates', 'duplicated_by'];
  if (!validRelTypes.includes(relType)) {
    return { isValid: false, error: `Relationship type must be one of: ${validRelTypes.join(', ')}` };
  }
  return { isValid: true };
}

/**
 * Validate entire memo form
 * @param title Memo title
 * @param body Memo body
 * @returns Validation result with all errors
 */
export function validateMemoForm(title: string, body: string): ValidationResult {
  const errors: Record<string, string> = {};

  const titleResult = validateMemoTitle(title);
  if (!titleResult.isValid && titleResult.error) {
    errors.title = titleResult.error;
  }

  const bodyResult = validateMemoBody(body);
  if (!bodyResult.isValid && bodyResult.error) {
    errors.body = bodyResult.error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
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
