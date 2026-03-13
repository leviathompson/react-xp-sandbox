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

const suits = ["hearts", "diamonds", "clubs", "spades"] as const;
const deck: CardType[] = suits.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({
        id: `${suit}-${i + 1}`,
        suit,
        rank: (i + 1) as Rank,
        isFaceUp: false,
    }))
).sort(() => Math.random() - 0.5);

const initialBoard: CardType[][] = Array.from({ length: 7 }, (_, i) => {
    const start = (i * (i + 1)) / 2;
    const end = start + (i + 1);
    
    return deck.slice(start, end).map((card, index) => ({
        ...card,
        isFaceUp: index === i
    }));
});

console.log(initialBoard);

const Solitaire = () => {
    const [boardState, setBoardState] = useState<BoardState>({} as BoardState);

    useEffect(() => {
        const initalBoardState = {
            deck: deck,
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
                                {deck.slice(0, 3).map(() => <Card/>)}
                            </div>
                            <div className={styles.hand}><Card {...deck[0]}/></div>
                        </div>
                        <div className="flex">
                            <div><Card {...deck[0]}/></div>
                            <div><Card {...deck[0]}/></div>
                            <div><Card {...deck[0]}/></div>
                            <div><Card {...deck[0]}/></div>
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
            {/* <Card key={item[index].id} {...item[index]}/> */}
        </>
    );
};

export default Solitaire;
