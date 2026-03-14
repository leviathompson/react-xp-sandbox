import { useEffect, useState } from "react";
import WindowMenu from "../../WindowMenu/WindowMenu";
import Card from "./Card/Card";
import styles from "./Solitaire.module.scss";

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface CardType {
    id: string;
    suit: Suit;
    rank: Rank;
    isFaceUp: boolean;
}

interface BoardState {
  deck: CardType[];
  suits: {
    1: CardType[];
    2: CardType[];
    3: CardType[];
    4: CardType[];
  };
  board: CardType[][];
  win: boolean;
}

const shuffle = (array: CardType[]) => {
    const shuffled = [...array];
  
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
    
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  
    return shuffled;
};

const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
const deck: CardType[] = suits.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({
        id: `${suit}-${i + 1}`,
        suit,
        rank: (i + 1) as Rank,
        isFaceUp: false,
    }))
);

const shuffledDeck = shuffle(deck);

const initialBoard: CardType[][] = Array.from({ length: 7 }, (_, i) => {
    const start = (i * (i + 1)) / 2;
    const end = start + (i + 1);
    
    return shuffledDeck.slice(start, end).map((card, index) => ({
        ...card,
        isFaceUp: index === i
    }));
});

console.log(initialBoard);

const Solitaire = () => {
    const [boardState, setBoardState] = useState<BoardState>({} as BoardState);

    useEffect(() => {
        const initalBoardState = {
            deck: shuffledDeck,
            suits: {
                1: [],
                2: [],
                3: [],
                4: [],
            },
            board: initialBoard,
            win: false
        };
        setBoardState(initalBoardState);
    }, []);

    if (!boardState.board) return;

    return (
        <>
            <WindowMenu menuItems={["Game", "Help"]}/>
            <div className={`${styles.solitaire} w-full h-full p-3`}>
                <main className="flex flex-col">
                    <div className="flex justify-between">
                        <div className="flex">
                            <div className={`${styles.deck} flex`}>
                                {boardState.deck.slice(0, 3).map((card) => <Card key={card.id} {...card}/>)}
                            </div>
                            <div className={styles.hand}><Card {...boardState.deck[0]}/></div>
                        </div>
                        <div className={`${styles.foundations} flex`}>
                            <div><Card isFaceUp={true} rank={1} suit="spades" /></div>
                            <div><Card /></div>
                            <div><Card isFaceUp={true} rank={4} suit="clubs" /></div>
                            <div><Card /></div>
                        </div>
                    </div>
                    <div className="flex">
                        {boardState.board.map((item) => { 
                            return (
                                <div>
                                    {item.map((card) => <Card key={card.id} {...card}/>)}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </>
    );
};

export default Solitaire;
