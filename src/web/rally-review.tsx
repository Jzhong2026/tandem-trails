import { useState } from 'react';
import type { RaceQuestion } from '../shared/race-questions.js';
import type { RallyQuiz } from '../shared/knowledge-rally.js';
import { RallyQuizCard } from './rally-quiz.js';

interface Props {
  questionBank: RaceQuestion[];
  questionIds: string[];
  onMastered: (id: string) => void;
  onExit: () => void;
}

export function RallyReview({ questionIds, questionBank, onMastered, onExit }: Props) {
  const [questions] = useState(() => questionIds.flatMap(id => questionBank.find(entry => entry.id === id) ?? []));
  const index = questions.findIndex(entry => entry.id === questionIds[0]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [firstTry, setFirstTry] = useState(true);
  const question = questions[index];
  if (!question) return null;
  const quiz: Pick<RallyQuiz, 'index' | 'questions' | 'feedback' | 'picked' | 'firstTry'> = {
    index,
    questions,
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
    if (questionIds.length === 1) onExit();
    else {
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
          continueLabel="完成复习"
          onAnswer={answer}
          onRetry={retry}
          onContinue={next}
        />
      </div>
    </div>
  </div>;
}
