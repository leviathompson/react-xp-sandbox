import { useEffect, useState } from "react";
import { getReadmeSpeechText, speakBonziText, stopBonziSpeech, subscribeToBonziSpeech } from "../../../utils/bonziBuddy";
import styles from "./BonziBuddy.module.scss";

const BonziBuddy = () => {
    const [speech, setSpeech] = useState({
        isSpeaking: false,
        currentSentence: "",
    });
    const [isReadingReadme, setIsReadingReadme] = useState(false);

    useEffect(() => subscribeToBonziSpeech((nextState) => {
        setSpeech(nextState);
        if (!nextState.isSpeaking) {
            setIsReadingReadme(false);
        }
    }), []);

    const onReadReadme = async () => {
        setIsReadingReadme(true);
        try {
            await speakBonziText(getReadmeSpeechText());
        } finally {
            setIsReadingReadme(false);
        }
    };

    return (
        <div className={styles.bonziBuddy}>
            {speech.isSpeaking && (
                <div className={styles.speechBubble} role="status" aria-live="polite">
                    {speech.currentSentence}
                </div>
            )}
            <div className={styles.avatarPanel}>
                <img src="/bonzi_buddy.gif" alt="Bonzi Buddy" />
            </div>

            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.readmeButton}
                    onClick={() => void onReadReadme()}
                    disabled={speech.isSpeaking && !isReadingReadme}
                >
                    {isReadingReadme ? "Reading ReadMe.txt..." : "Read ReadMe.txt"}
                </button>
                <button
                    type="button"
                    className={styles.stopButton}
                    onClick={stopBonziSpeech}
                    disabled={!speech.isSpeaking}
                >
                    Stop
                </button>
            </div>
        </div>
    );
};

export default BonziBuddy;
