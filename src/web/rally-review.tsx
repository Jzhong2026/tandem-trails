import { useState } from 'react';
import { RACE_QUESTIONS } from '../shared/knowledge-rally.js';
import type { RallyQuiz } from '../shared/knowledge-rally.js';
import { RallyQuizCard } from './rally-quiz.js';

interface Props {
  questionIds: string[];
  onMastered: (id: string) => void;
  onExit: () => void;
}

export function RallyReview({ questionIds, onMastered, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [firstTry, setFirstTry] = useState(true);
  const question = RACE_QUESTIONS.find(entry => entry.id === questionIds[index]);
  if (!question) return null;
  const quiz: Pick<RallyQuiz, 'index' | 'questions' | 'feedback' | 'picked' | 'firstTry'> = {
    index,
    questions: questionIds.map(id => RACE_QUESTIONS.find(entry => entry.id === id)!).filter(Boolean),
    feedback,
    picked,
    firstTry,
  };

  const answer = (option: number) => {
    if (feedback) return;
    setPicked(option);
    if (option === question.answer) setFeedback('correct');
    else {
      setFeedback('wrong');
      setFirstTry(false);
    }
  };
  const retry = () => { setFeedback(null); setPicked(null); };
  const next = () => {
    onMastered(question.id);
    if (index + 1 >= questionIds.length) onExit();
    else {
      setIndex(value => value + 1);
      setFeedback(null);
      setPicked(null);
      setFirstTry(true);
    }
  };

  return <div className="rally-game">
    <div className="rally-overlay">
      <div style={{ width: 'min(680px, 100%)' }}>
        <div className="rally-quiz-top" style={{ marginBottom: 12 }}>
          <span className="rally-quiz-kicker">错题复盘 · 把不会变成会</span>
          <button className="rally-btn ghost small" onClick={onExit}>暂存进度</button>
        </div>
        <RallyQuizCard
          key={question.id}
          question={question}
          quiz={quiz}
          continueLabel={index + 1 === questionIds.length ? '完成复习' : '下一道错题'}
          onAnswer={answer}
          onRetry={retry}
          onContinue={next}
        />
      </div>
    </div>
  </div>;
}
