import styles from "./Card.module.scss";

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface Card {
  suit?: Suit;
  rank?: Rank;
  isFaceUp?: boolean;
}

const Card = ({suit, rank, isFaceUp=false}: Card) => {

    if (!isFaceUp) {
        return (
            <div className={styles.card}>
                <div className={styles.faceDown}></div>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <div data-suit={suit} data-rank={rank}></div>
        </div>
    );
};

export default Card;
