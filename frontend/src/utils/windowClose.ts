const closeHandlers = new Map<string, () => boolean | Promise<boolean>>();

const normalizeWindowId = (windowId: string | number) => String(windowId);

export const registerWindowCloseHandler = (
    windowId: string | number,
    handler: () => boolean | Promise<boolean>,
) => {
    const normalizedWindowId = normalizeWindowId(windowId);
    closeHandlers.set(normalizedWindowId, handler);

    return () => {
        if (closeHandlers.get(normalizedWindowId) === handler) {
            closeHandlers.delete(normalizedWindowId);
        }
    };
};

export const requestWindowClose = async (windowId: string | number) => {
    const handler = closeHandlers.get(normalizeWindowId(windowId));
    if (!handler) return true;
    return await handler();
};
