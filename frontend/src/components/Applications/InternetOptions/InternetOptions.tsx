import { useEffect, useState } from "react";
import { useContext } from "../../../context/context";
import { usePoints } from "../../../context/points";
import Button from "../../Button/Button";
import styles from "./InternetOptions.module.scss";

const INTERNET_OPTIONS_TABS = ["General", "Security", "Privacy", "Content", "Connections", "Programs", "Advanced"] as const;
const DEFAULT_HOME_PAGE = "https://www.msn.com";

type InternetOptionsTab = typeof INTERNET_OPTIONS_TABS[number];

interface InternetOptionsProps {
    id?: string | number;
    parentWindowId?: string | number;
}

const normalizeHomePage = (value: string) => {
    const trimmedValue = value.trim();
    return trimmedValue || "about:blank";
};

const InternetOptions = ({ id, parentWindowId }: InternetOptionsProps) => {
    const { currentWindows, dispatch } = useContext();
    const { awardPoints } = usePoints();
    const [selectedTab, setSelectedTab] = useState<InternetOptionsTab>("General");

    const parentWindow = currentWindows.find((window) => window.id === parentWindowId);
    const currentDialog = currentWindows.find((window) => window.id === id);
    const initialHomePage = parentWindow?.homePage || parentWindow?.landingUrl || DEFAULT_HOME_PAGE;
    const currentPage = parentWindow?.currentUrl || parentWindow?.landingUrl || initialHomePage;
    const [homePageValue, setHomePageValue] = useState(initialHomePage);

    useEffect(() => {
        setHomePageValue(initialHomePage);
    }, [initialHomePage]);

    const closeDialog = () => {
        const updatedCurrentWindows = currentWindows
            .filter((window) => window.id !== currentDialog?.id)
            .map((window) => ({
                ...window,
                active: window.id === parentWindowId ? true : window.active,
                hidden: window.id === parentWindowId ? false : window.hidden,
            }));
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const applyChanges = () => {
        if (!parentWindow) return;

        const updatedCurrentWindows = [...currentWindows];
        const targetWindow = updatedCurrentWindows.find((window) => window.id === parentWindowId);

        if (!targetWindow) return;

        targetWindow.homePage = normalizeHomePage(homePageValue);
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
    };

    const handleOk = () => {
        applyChanges();
        closeDialog();
    };

    const handleClearHistory = () => {
        if (!parentWindow) return;

        const updatedCurrentWindows = [...currentWindows];
        const targetWindow = updatedCurrentWindows.find((window) => window.id === parentWindowId);

        if (!targetWindow) return;

        targetWindow.history = [];
        targetWindow.forward = [];
        dispatch({ type: "SET_CURRENT_WINDOWS", payload: updatedCurrentWindows });
        awardPoints("delete-browser-history");
    };

    const renderGeneralTab = () => (
        <div className={styles.tabPanel}>
            <section className={styles.groupBox}>
                <h3>Home page</h3>
                <div className={styles.groupContent}>
                    <img src="/icon__internet_explorer.png" width="28" height="28" alt="" />
                    <div className={styles.groupBody}>
                        <p>You can change which page to use for your home page.</p>
                        <label className={styles.addressRow}>
                            <span>Address:</span>
                            <input
                                type="text"
                                value={homePageValue}
                                onChange={(event) => setHomePageValue(event.currentTarget.value)}
                            />
                        </label>
                        <div className={styles.inlineButtons}>
                            <Button type="button" onClick={() => setHomePageValue(normalizeHomePage(currentPage))}>Use Current</Button>
                            <Button type="button" onClick={() => setHomePageValue(DEFAULT_HOME_PAGE)}>Use Default</Button>
                            <Button type="button" onClick={() => setHomePageValue("about:blank")}>Use Blank</Button>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.groupBox}>
                <h3>Temporary Internet files</h3>
                <div className={styles.groupContent}>
                    <img src="/icon__globe.png" width="28" height="28" alt="" />
                    <div className={styles.groupBody}>
                        <p>Pages you view on the Internet are stored in a special folder for quick viewing later.</p>
                        <div className={styles.inlineButtons}>
                            <Button type="button" disabled>Delete Cookies...</Button>
                            <Button type="button" disabled>Delete Files...</Button>
                            <Button type="button" disabled>Settings...</Button>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.groupBox}>
                <h3>History</h3>
                <div className={styles.groupContent}>
                    <img src="/icon__history--large.png" width="28" height="28" alt="" />
                    <div className={styles.groupBody}>
                        <p>The History folder contains links to pages you&apos;ve visited, for quick access to recently viewed pages.</p>
                        <div className={styles.historyControls}>
                            <label>
                                <span>Days to keep pages in history:</span>
                                <select defaultValue="20" disabled>
                                    <option value="20">20</option>
                                </select>
                            </label>
                            <Button type="button" onClick={handleClearHistory}>Clear History</Button>
                        </div>
                    </div>
                </div>
            </section>

            <div className={styles.bottomActions}>
                <Button type="button" disabled>Colors...</Button>
                <Button type="button" disabled>Fonts...</Button>
                <Button type="button" disabled>Languages...</Button>
                <Button type="button" disabled>Accessibility...</Button>
            </div>
        </div>
    );

    const renderPlaceholderTab = () => (
        <div className={styles.placeholderPanel}>
            <h3>{selectedTab}</h3>
            <p>These Internet Explorer settings are not wired up yet in this build.</p>
        </div>
    );

    return (
        <div className={`${styles.internetOptions} flex flex-col justify-between h-full p-3`}>
            <nav className={styles.tabs} aria-label="Internet Options Tabs">
                {INTERNET_OPTIONS_TABS.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        data-active={selectedTab === tab}
                        onClick={() => setSelectedTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </nav>
            <main className="h-full overflow-scroll">
                <section className={styles.panel}>
                    {selectedTab === "General" ? renderGeneralTab() : renderPlaceholderTab()}
                </section>
            </main>

            <footer className="flex justify-end gap-2 mt-2">
                <Button type="button" data-primary onClick={handleOk}>OK</Button>
                <Button type="button" onClick={closeDialog}>Cancel</Button>
                <Button type="button" onClick={applyChanges}>Apply</Button>
            </footer>
        </div>
    );
};

export default InternetOptions;
