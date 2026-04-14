import { useEffect } from "react";
import { usePoints } from "../../../context/points";
import styles from "./BonziBuddy.module.scss";

const BonziBuddy = () => {
    const { awardPoints } = usePoints();

    useEffect(() => {
        awardPoints("open-bonzi-buddy");
    }, [awardPoints]);

    return (
        <div className={styles.bonziBuddy}>
            <img src="/bonzi_buddy.gif" alt="Bonzi Buddy" />
        </div>
    );
};

export default BonziBuddy;
