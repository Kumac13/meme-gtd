import '@testing-library/jest-dom';

// jsdomにnative dialog APIがないため、open属性の切り替えだけを補う。
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };
