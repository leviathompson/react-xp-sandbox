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
        let keyboardOpen = false;
        console.log('[viewport] init — height:', vv.height, 'offsetTop:', vv.offsetTop, 'scrollY:', window.scrollY);

        const handleResize = () => {
            maxHeight = Math.max(maxHeight, vv.height);
            const heightDrop = maxHeight - vv.height;

            if (heightDrop > 150) {
                keyboardOpen = true;
            } else if (keyboardOpen && heightDrop < 50) {
                keyboardOpen = false;
                console.log('[viewport] keyboard dismissed — scrollY:', window.scrollY, 'offsetTop:', vv.offsetTop);
                if (window.scrollY !== 0) {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    console.log('[viewport] snapBack — after scrollY:', window.scrollY);
                }
            }

            console.log('[viewport] resize — height:', vv.height, 'maxHeight:', maxHeight, 'heightDrop:', heightDrop, 'keyboardOpen:', keyboardOpen, 'offsetTop:', vv.offsetTop, 'scrollY:', window.scrollY);
        };

        vv.addEventListener('resize', handleResize);
        return () => vv.removeEventListener('resize', handleResize);
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
