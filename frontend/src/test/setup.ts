import "@testing-library/jest-dom/vitest";

beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal"></div>';
    window.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
});
