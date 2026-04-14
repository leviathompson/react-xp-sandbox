import { useEffect, useState } from "react";

interface AnimatedScoreProps {
    value: number | string;
    className?: string;
    title?: string;
}

const SCORE_TICK_MS = 20;

const AnimatedScore = ({ value, className, title }: AnimatedScoreProps) => {
    const numericValue = Number(value) || 0;
    const [displayValue, setDisplayValue] = useState(numericValue);

    useEffect(() => {
        if (numericValue <= displayValue) {
            setDisplayValue(numericValue);
            return;
        }

        const intervalId = window.setInterval(() => {
            setDisplayValue((currentValue) => {
                if (currentValue >= numericValue) {
                    window.clearInterval(intervalId);
                    return numericValue;
                }

                const nextValue = currentValue + 1;
                if (nextValue >= numericValue) {
                    window.clearInterval(intervalId);
                    return numericValue;
                }

                return nextValue;
            });
        }, SCORE_TICK_MS);

        return () => window.clearInterval(intervalId);
    }, [displayValue, numericValue]);

    return (
        <span className={className} title={title}>
            {displayValue}
        </span>
    );
};

export default AnimatedScore;
