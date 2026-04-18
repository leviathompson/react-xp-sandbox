import { Activity, useEffect } from "react";
import Desktop from "./components/Desktop/Desktop";
import Bsod from "./components/Bsod/Bsod";
import ContextMenu from "./components/ContextMenu/ContextMenu";
import Login from "./components/Login/Login";
import TaskBar from "./components/TaskBar/TaskBar";
import Wallpaper from "./components/Wallpaper/Wallpaper";
import WindowManagement from "./components/WindowManagement/WindowManagement";
import { useContext } from "./context/context";

function App() {
    const {windowsInitiationState, isInitialBoot, initiationStage, dispatch} = useContext();

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) {
            console.log('[viewport] visualViewport API not available');
            return;
        }

        let maxHeight = vv.height;
        console.log('[viewport] init — height:', vv.height, 'offsetTop:', vv.offsetTop, 'scrollY:', window.scrollY);

        const snapBack = (trigger: string) => {
            const before = { scrollY: window.scrollY, docScrollTop: document.documentElement.scrollTop, bodyScrollTop: document.body.scrollTop };
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            console.log('[viewport] snapBack via', trigger, '| before:', before, '| after scrollY:', window.scrollY);
        };

        const handleResize = () => {
            maxHeight = Math.max(maxHeight, vv.height);
            const isKeyboardDismissed = vv.height >= maxHeight - 50;
            console.log('[viewport] resize — height:', vv.height, 'maxHeight:', maxHeight, 'offsetTop:', vv.offsetTop, 'scrollY:', window.scrollY, 'keyboardDismissed:', isKeyboardDismissed);
            if (isKeyboardDismissed) snapBack('resize');
        };

        const handleScroll = () => {
            const isOffsetNear0 = Math.abs(vv.offsetTop) < 5;
            console.log('[viewport] scroll — height:', vv.height, 'offsetTop:', vv.offsetTop, 'scrollY:', window.scrollY, 'offsetNear0:', isOffsetNear0);
            if (isOffsetNear0) snapBack('scroll');
        };

        vv.addEventListener('resize', handleResize);
        vv.addEventListener('scroll', handleScroll);
        return () => {
            vv.removeEventListener('resize', handleResize);
            vv.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        const delayMap = [500, 500, 500];
        if (windowsInitiationState !== "loggedIn" || initiationStage >= delayMap.length) return;
        
        if(isInitialBoot) dispatch({ type: "SET_IS_INITIAL_BOOT", payload: false });
        
        const delay = setTimeout(() => {
            dispatch({ type: "SET_INITIATION_STAGE", payload: initiationStage + 1});

        }, delayMap[initiationStage]);

        return () => clearTimeout(delay);
    }, [isInitialBoot, initiationStage, windowsInitiationState, dispatch]);

    if (windowsInitiationState === "bsod") {
        return <Bsod />;
    }

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
        </>
    );
}

export default App;
