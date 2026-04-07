import { useContext } from "../../context/context";
import applicationsJSON from "../../data/applications.json";
import Window from "../Window/Window";
import { WindowContent } from "../WindowContent/WindowContent";
import type { Application } from "../../context/types";

const applications = applicationsJSON as unknown as Record<string, Application>;

const WindowManagement = () => {
    const { currentWindows, customApplications } = useContext();
    const mergedApplications = { ...applications, ...customApplications };

    return (
        currentWindows.map((currentWindow) => {
            const appId = currentWindow.appId;
            const windowApplication = mergedApplications[currentWindow.appId];
            if (!windowApplication) return null;

            const { component, content } = windowApplication;
            return <Window key={currentWindow.id} {...currentWindow}><WindowContent key={appId} componentId={component} content={content} {...currentWindow} /></Window>;
        })
    );
};

export default WindowManagement;
