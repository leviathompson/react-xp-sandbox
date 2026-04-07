import { Activity, useEffect, useRef } from "react";
import Desktop from "./components/Desktop/Desktop";
import { AwardToast } from "./components/AwardToast/AwardToast";
import ContextMenu from "./components/ContextMenu/ContextMenu";
import { DebugPanel } from "./components/DebugPanel/DebugPanel";
import Login from "./components/Login/Login";
import TaskBar from "./components/TaskBar/TaskBar";
import Wallpaper from "./components/Wallpaper/Wallpaper";
import WindowManagement from "./components/WindowManagement/WindowManagement";
import { useContext } from "./context/context";
import { usePoints } from "./context/points";

const CLICK_THRESHOLDS = [
    { ruleId: "click-100" as const, threshold: 100 },
    { ruleId: "click-1000" as const, threshold: 1000 },
    { ruleId: "click-10000" as const, threshold: 10000 },
];

function App() {
    const {windowsInitiationState, isInitialBoot, initiationStage, dispatch} = useContext();
    const { awardPoints } = usePoints();
    const clickCountRef = useRef(0);

    useEffect(() => {
        if (windowsInitiationState !== "loggedIn") return;

        const onClickCapture = () => {
            clickCountRef.current += 1;
            const count = clickCountRef.current;
            for (const { ruleId, threshold } of CLICK_THRESHOLDS) {
                if (count === threshold) awardPoints(ruleId);
            }
        };

        document.addEventListener("click", onClickCapture);
        return () => document.removeEventListener("click", onClickCapture);
    }, [windowsInitiationState, awardPoints]);

    useEffect(() => {
        const delayMap = [500, 500, 500];
        if (windowsInitiationState !== "loggedIn" || initiationStage >= delayMap.length) return;
        
        if(isInitialBoot) dispatch({ type: "SET_IS_INITIAL_BOOT", payload: false });
        
        const delay = setTimeout(() => {
            dispatch({ type: "SET_INITIATION_STAGE", payload: initiationStage + 1});

        }, delayMap[initiationStage]);

        return () => clearTimeout(delay);
    }, [isInitialBoot, initiationStage, windowsInitiationState, dispatch]);

    return (
        <>
            <Activity mode={(["shutDown", "bios", "welcome", "transition", "login", "loggingIn"].includes(windowsInitiationState)) ? "visible" : "hidden"}>
                <Login />
            </Activity>
            <Wallpaper />
            <Activity mode={(initiationStage > 0) ? "visible" : "hidden"}>
                <Desktop />
            </Activity>
            <Activity mode={(initiationStage > 1) ? "visible" : "hidden"}>
                <TaskBar />
            </Activity>
            <Activity mode={(initiationStage > 2) ? "visible" : "hidden"}>
                <WindowManagement />
            </Activity>
            <ContextMenu />
            <AwardToast />
            {import.meta.env.DEV && <DebugPanel />}
        </>
    );
}

export default App;
