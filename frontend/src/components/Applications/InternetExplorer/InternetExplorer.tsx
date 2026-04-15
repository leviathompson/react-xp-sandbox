import { useRef, useState, useEffect } from "react";
import type { HTMLAttributeReferrerPolicy } from "react";
import { useContext } from "../../../context/context";
import applicationsJSON from "../../../data/applications.json";
import savedPasswords from "../../../data/savedPasswords.json";
import { generateUniqueId, sameBaseDomain, getCurrentWindow } from "../../../utils/general";
import styles from "./InternetExplorer.module.scss";
import type { Application } from "../../../context/types";

const Applications = applicationsJSON as unknown as Record<string, Application>;
const DEFAULT_HOME_PAGE = "https://www.msn.com";
const TOP_LEVEL_MENUS = ["File", "Edit", "View", "Favorites", "Tools", "Help"];

type BrowserMenuItem = {
    label?: string;
    hasSubMenu?: boolean;
    action?: "openInternetOptions" | "openSavedPasswords";
    url?: string;
    separator?: boolean;
};

type IframeSecurity = {
    sandbox?: string;
    referrerPolicy?: HTMLAttributeReferrerPolicy;
};

type SavedPassword = {
    id: string;
    username: string;
    site: string;
    password: string;
    createdAt: string;
};

const passwordEntries = savedPasswords as SavedPassword[];

const FAVORITES_MENU_ITEMS: BrowserMenuItem[] = [
    { label: "Add to favorites..." },
    { separator: true },
    { label: "Neopets", url: "https://www.neopets.org" },
    { label: "Homestar Runner", url: "https://homestarrunner.com" },
    { label: "Newgrounds", url: "https://www.newgrounds.com" },
    { label: "Miniclip", url: "https://www.miniclip.com" },
    { label: "Addicting Games", url: "https://www.addictinggames.com" },
    { label: "Albino Blacksheep", url: "https://www.albinoblacksheep.com" },
    { label: "GameFAQs", url: "https://www.gamefaqs.com" },
    { label: "Ebaumsworld", url: "https://www.ebaumsworld.com" },
    { label: "Runescape", url: "https://www.runescape.com" },
] as const;

const TOOLS_MENU_ITEMS: BrowserMenuItem[] = [
    { label: "Mail and News", hasSubMenu: true },
    { label: "Pop-up Blocker", hasSubMenu: true },
    { label: "Manage Add-ons..." },
    { label: "Synchronize..." },
    { label: "Windows Update" },
    { separator: true },
    { label: "Diagnose Connection Problems..." },
    { label: "RoboForm Toolbar" },
    { label: "Save Forms" },
    { label: "Fill Forms" },
    { label: "Saved Passwords...", action: "openSavedPasswords" },
    { separator: true },
    { label: "Internet Options...", action: "openInternetOptions" },
] as const;

const formatPasswordDate = (iso: string) => new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
});

const InternetExplorer = ({ appId }: Record<string, string>) => {
    const { currentWindows, dispatch } = useContext();
    const [isBackDisabled, setIsBackDisabled] = useState(true);
    const [isForwardDisabled, setIsForwardDisabled] = useState(true);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [activeExplorerBar, setActiveExplorerBar] = useState<"favorites" | "savedPasswords" | null>(null);
    const [selectedPasswordId, setSelectedPasswordId] = useState<string | null>(passwordEntries[0]?.id || null);
    const { currentWindow, updatedCurrentWindows } = getCurrentWindow(currentWindows);
    const HOMEPAGE = currentWindow?.homePage || currentWindow?.landingUrl || DEFAULT_HOME_PAGE;

    const inputFieldRef = useRef<HTMLInputElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const inputField = inputFieldRef.current;
    const currentUrl = useRef<string>(HOMEPAGE);

    useEffect(() => {
        if (!currentWindow) return;

        if (currentWindow.history) setIsBackDisabled(currentWindow.history.length === 0);
        if (currentWindow.forward) setIsForwardDisabled(currentWindow.forward.length === 0);
    }, [currentWindow, currentWindows]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            setActiveMenu(null);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setActiveMenu(null);
        };

        document.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const appData = Applications[appId];
    const selectedPassword = passwordEntries.find((entry) => entry.id === selectedPasswordId) || passwordEntries[0] || null;

    const setWindowCurrentUrl = (nextUrl: string) => {
        currentUrl.current = nextUrl;
        if (currentWindow) currentWindow.currentUrl = nextUrl;
    };

    const backClickHandler = () => {
        if (!currentWindow?.history || !currentWindow?.forward || !inputField?.value) return;

        currentWindow.forward.push(inputField.value);
        inputField.value = currentWindow.history.pop() || "";
        setWindowCurrentUrl(inputField.value);

        updateIframe();
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const forwardClickHandler = () => {
        if (!currentWindow?.history || !currentWindow?.forward || !inputField?.value) return;

        currentWindow.history.push(inputField.value);
        inputField.value = currentWindow.forward.pop() || "";
        setWindowCurrentUrl(inputField.value);

        updateIframe();
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const iframe = iframeRef.current;

    const getIframeSrc = (inputValue: string) => {
        if (inputValue === "about:blank") return { url: "about:blank", value: "about:blank" };

        const value = !inputValue.startsWith("http") ? `https://${inputValue}` : inputValue;
        const wayBackUrl = "https://web.archive.org/web/20030612074004if_/";
        const url = sameBaseDomain(value) ? value : `/proxy.php?url=${encodeURIComponent(`${wayBackUrl}${value}`)}`;
        return { url, value };
    };

    const getIframeSecurity = (targetValue: string): IframeSecurity => {
        if (targetValue === "about:blank") {
            return {
                sandbox: undefined,
                referrerPolicy: undefined,
            };
        }

        if (sameBaseDomain(targetValue)) {
            return {
                sandbox: "allow-same-origin allow-forms",
                referrerPolicy: "no-referrer",
            };
        }

        return {
            sandbox: "allow-forms allow-scripts",
            referrerPolicy: "no-referrer",
        };
    };

    const updateIframe = (nextValue?: string) => {
        if (!inputField && !nextValue) return;
        const inputValue = nextValue ?? inputField?.value ?? HOMEPAGE;
        const { url, value } = getIframeSrc(inputValue);
        const { sandbox, referrerPolicy } = getIframeSecurity(value);

        if (iframe) {
            if (sandbox) iframe.setAttribute("sandbox", sandbox);
            else iframe.removeAttribute("sandbox");

            if (referrerPolicy) iframe.setAttribute("referrerPolicy", referrerPolicy);
            else iframe.removeAttribute("referrerPolicy");
        }

        if (inputField && nextValue !== undefined) inputField.value = nextValue;
        if (iframe) iframe.setAttribute("src", url);
    };

    const submitURLHandler = () => {
        if (currentUrl.current === inputField?.value) return;
        if (currentWindow && currentWindow.history && currentUrl) {
            if (currentUrl.current !== currentWindow.history.at(-1)) currentWindow.history.push(currentUrl.current);
            if (currentWindow.forward) currentWindow.forward = [];

            const newUrl = inputField?.value ?? "";
            if (newUrl) setWindowCurrentUrl(newUrl);

            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
            updateIframe();
        }
    };

    const keyDownHandler = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") submitURLHandler();
    };

    const stopClickHandler = () => {
        setWindowCurrentUrl("about:blank");
        if (iframe) iframe.setAttribute("src", "about:blank");
    };

    const refreshClickHandler = () => {
        updateIframe();
    };

    const homeClickHandler = () => {
        if (inputField) inputField.value = HOMEPAGE;
        setWindowCurrentUrl(HOMEPAGE);
        updateIframe(HOMEPAGE);
    };

    const navigateToUrl = (nextUrl: string) => {
        if (!currentWindow) return;

        if (currentWindow.history && currentUrl.current !== currentWindow.history.at(-1)) {
            currentWindow.history.push(currentUrl.current);
        }

        if (currentWindow.forward) currentWindow.forward = [];

        setWindowCurrentUrl(nextUrl);
        setActiveExplorerBar(null);

        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
        updateIframe(nextUrl);
    };

    const handleTopLevelMenuClick = (menuItem: string) => {
        if (!["Favorites", "Tools"].includes(menuItem)) return;
        setActiveMenu((currentMenu) => currentMenu === menuItem ? null : menuItem);
    };

    const openSavedPasswords = () => {
        setActiveMenu(null);
        setActiveExplorerBar("savedPasswords");
        setSelectedPasswordId((currentId) => currentId || passwordEntries[0]?.id || null);
    };

    const handleMenuItemAction = ({ action, url }: Pick<BrowserMenuItem, "action" | "url">) => {
        setActiveMenu(null);
        if (url) {
            navigateToUrl(url);
            return;
        }

        if (action === "openSavedPasswords") {
            openSavedPasswords();
            return;
        }

        if (action !== "openInternetOptions") return;
        if (!currentWindow) return;

        currentWindow.currentUrl = inputField?.value || currentUrl.current || HOMEPAGE;

        const existingWindow = currentWindows.find((window) =>
            window.appId === "internetOptions" && window.parentWindowId === currentWindow.id
        );

        if (existingWindow) {
            const updatedWindows = currentWindows.map((window) => ({
                ...window,
                active: window.id === existingWindow.id,
                hidden: window.id === existingWindow.id ? false : window.hidden,
            }));
            dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedWindows });
            return;
        }

        const updatedWindows = currentWindows.map((window) => ({
            ...window,
            active: false,
        }));
        updatedWindows.push({
            id: generateUniqueId(),
            appId: "internetOptions",
            parentWindowId: currentWindow.id,
            active: true,
        });
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedWindows });
    };

    const toggleFavoritesBar = () => {
        setActiveExplorerBar((currentBar) => currentBar === "favorites" ? null : "favorites");
    };

    const initialIframe = getIframeSrc(inputField?.value || HOMEPAGE);
    const initialIframeSecurity = getIframeSecurity(initialIframe.value);

    return (
        <div className={styles.internetExplorer}>
            <div className={styles.menusContainer}>
                <div className={`${styles.windowMenu} flex justify-between`} ref={menuRef}>
                    <div className="relative overflow-hidden w-full">
                        <ul className="flex mx-1">
                            {TOP_LEVEL_MENUS.map((menuItem) => {
                                const isInteractive = ["Favorites", "Tools"].includes(menuItem);

                                return (
                                    <li
                                        key={menuItem}
                                        className="display-block my-1 px-2.5 py-1"
                                        data-active={activeMenu === menuItem}
                                        data-enabled={isInteractive}
                                        onMouseEnter={() => {
                                            if (activeMenu && isInteractive) setActiveMenu(menuItem);
                                        }}
                                    >
                                        <button type="button" onClick={() => handleTopLevelMenuClick(menuItem)}>{menuItem}</button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <img src="icon__windows_logo.png" height="100%" width="40" />

                    {activeMenu === "Favorites" && (
                        <div className={styles.favoritesMenu} role="menu" aria-label="Favorites">
                            {FAVORITES_MENU_ITEMS.map((item, index) => {
                                if (item.separator) {
                                    return <div key={`favorites-separator-${index}`} className={styles.menuSeparator} />;
                                }

                                return (
                                    <button
                                        key={item.label}
                                        type="button"
                                        className={styles.toolsMenuItem}
                                        role="menuitem"
                                        onClick={() => handleMenuItemAction(item)}
                                    >
                                        <span>{item.label}</span>
                                        {item.hasSubMenu && <span>&gt;</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {activeMenu === "Tools" && (
                        <div className={styles.toolsMenu} role="menu" aria-label="Tools">
                            {TOOLS_MENU_ITEMS.map((item, index) => {
                                if (item.separator) {
                                    return <div key={`separator-${index}`} className={styles.menuSeparator} />;
                                }

                                return (
                                    <button
                                        key={item.label}
                                        type="button"
                                        className={styles.toolsMenuItem}
                                        role="menuitem"
                                        onClick={() => handleMenuItemAction(item)}
                                    >
                                        <span>{item.label}</span>
                                        {item.hasSubMenu && <span>&gt;</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <section className={`${styles.appMenu} relative`}>
                    <div className="flex absolute">
                        <div className="flex shrink-0">
                            <button className="flex items-center m-0.5" onClick={backClickHandler} disabled={isBackDisabled}>
                                <img className="mr-2" src="/icon__back.png" width="20" height="20" />
                                <h4>Back</h4>
                                <span className="h-full"><span className={styles.dropdown}>▼</span></span>
                            </button>
                            <button className="flex items-center m-0.5" onClick={forwardClickHandler} disabled={isForwardDisabled}>
                                <img src="/icon__forward.png" width="20" height="20" />
                                <h4 className="hidden">Forward</h4>
                                <span className="h-full"><span className={styles.dropdown}>▼</span></span>
                            </button>
                            <button className="flex items-center m-0.5" onClick={stopClickHandler}>
                                <img src="/icon__stop--large.png" width="20" height="20" />
                                <h4 className="hidden">Stop</h4>
                            </button>
                            <button className="flex items-center m-0.5" onClick={refreshClickHandler}>
                                <img src="/icon__refresh--large.png" width="20" height="20" />
                                <h4 className="hidden">Refresh</h4>
                            </button>
                            <button className="flex items-center m-0.5" onClick={homeClickHandler}>
                                <img src="/icon__home--large.png" width="20" height="20" />
                                <h4 className="hidden">Home</h4>
                            </button>
                        </div>
                        <div className="flex shrink-0">
                            <button className="flex items-center m-0.5 cursor-not-allowed">
                                <img className="mr-2" src="/icon__search--large.png" width="20" height="20" />
                                <h4>Search</h4>
                            </button>
                            <button className="flex items-center m-0.5" data-active={activeExplorerBar === "favorites"} onClick={toggleFavoritesBar}>
                                <img className="mr-2" src="/icon__favourites--large.png" width="20" height="20" />
                                <h4>Favourites</h4>
                            </button>
                            <button className="flex items-center m-0.5 cursor-not-allowed">
                                <img className="mr-2" src="/icon__history--large.png" width="20" height="20" />
                                <h4 className="hidden">History</h4>
                            </button>
                        </div>
                        <div className="flex shrink-0">
                            <button className="flex items-center m-0.5 cursor-not-allowed">
                                <img className="mr-2" src="/icon__mail--large.png" width="20" height="20" />
                                <h4 className="hidden">Mail</h4>
                            </button>
                            <button className="flex items-center m-0.5 cursor-not-allowed">
                                <img className="mr-2" src="/icon__print--large.png" width="20" height="20" />
                                <h4 className="hidden">Print</h4>
                            </button>
                        </div>
                    </div>
                </section>
                <section className={`${styles.navMenu} relative`}>
                    <div className="w-full h-full flex items-center absolute px-3">
                        <span className={`${styles.navLabel} mr-1`}>Address</span>

                        <div className={`${styles.navBar} flex mx-1 h-full`}>
                            <img src={appData.icon || appData.iconLarge} className="mx-1" width="14" height="14" />
                            <input ref={inputFieldRef} className={`${styles.navBar} h-full`} type="text" defaultValue={HOMEPAGE} onKeyDown={keyDownHandler} />
                            <button className={styles.dropDown}>Submit</button>
                        </div>
                        <button className={`${styles.goButton} flex items-center`} onClick={submitURLHandler}>
                            <img src="/icon__go.png" className="mr-1.5" width="19" height="19" />
                            <span>Go</span>
                        </button>
                    </div>
                </section>
            </div>
            <main className={`${styles.mainContent} h-full flex overflow-auto`}>
                {activeExplorerBar === "favorites" && (
                    <aside className={styles.explorerBar}>
                        <div className={styles.explorerBarHeader}>
                            <span>Favorites</span>
                            <button type="button" onClick={toggleFavoritesBar} aria-label="Close Favorites">×</button>
                        </div>
                        <div className={styles.explorerBarBody}>
                            <ul className={styles.explorerBarList}>
                                {FAVORITES_MENU_ITEMS.filter((item) => !item.separator).map((item) => (
                                    <li key={item.label}>
                                        <button type="button" onClick={() => item.url && navigateToUrl(item.url)}>
                                            <img src="/icon__favourites--large.png" width="16" height="16" alt="" />
                                            <span>{item.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                )}
                <div className={styles.browserFrame}>
                    {activeExplorerBar === "savedPasswords" ? (
                        <section className={styles.savedPasswords}>
                            <div className={styles.savedPasswordsHeader}>
                                <div>
                                    <h2>Saved Passwords</h2>
                                    <p>Stored Internet Explorer form logins for Gerrit.</p>
                                </div>
                                <button type="button" onClick={() => setActiveExplorerBar(null)}>Close</button>
                            </div>
                            <div className={styles.savedPasswordsBody}>
                                <aside className={styles.savedPasswordsList}>
                                    {passwordEntries.map((entry) => (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            className={styles.savedPasswordRow}
                                            data-active={selectedPassword?.id === entry.id}
                                            onClick={() => setSelectedPasswordId(entry.id)}
                                        >
                                            <strong>{`${entry.username} (${entry.site})`}</strong>
                                            <span>{new Date(entry.createdAt).getFullYear()}</span>
                                        </button>
                                    ))}
                                </aside>
                                <section className={styles.savedPasswordDetails}>
                                    {selectedPassword ? (
                                        <>
                                            <h3>{selectedPassword.site}</h3>
                                            <dl>
                                                <div>
                                                    <dt>Username</dt>
                                                    <dd>{selectedPassword.username}</dd>
                                                </div>
                                                <div>
                                                    <dt>Password</dt>
                                                    <dd>{selectedPassword.password}</dd>
                                                </div>
                                                <div>
                                                    <dt>Created</dt>
                                                    <dd>{formatPasswordDate(selectedPassword.createdAt)}</dd>
                                                </div>
                                            </dl>
                                            <p className={styles.savedPasswordNote}>
                                                No saved password exists for gerrit@hotmail.com.
                                            </p>
                                        </>
                                    ) : (
                                        <div className={styles.savedPasswordEmpty}>No saved passwords found.</div>
                                    )}
                                </section>
                            </div>
                        </section>
                    ) : (
                        <iframe
                            ref={iframeRef}
                            src={initialIframe.url}
                            sandbox={initialIframeSecurity.sandbox}
                            referrerPolicy={initialIframeSecurity.referrerPolicy}
                            width="100%"
                            height="100%"
                        />
                    )}
                </div>
            </main>
            <div className={`${styles.statusBar} flex justify-between px-2 py-0.5`}>
                <div className="flex items-center gap-1">
                    <img src="icon__internet_explorer.png" height="12" width="12" />
                    <p>Done</p>
                </div>
                <div className="flex">
                    <div className="flex items-center">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className={styles.verticaLine}></div>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 ml-3 w-44">
                        <img src="icon__globe.png" height="12" width="12" />
                        <p>Internet</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InternetExplorer;
