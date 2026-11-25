import type { RaceQuestion } from '../shared/race-questions.js';
import type { RallyQuiz } from '../shared/knowledge-rally.js';

interface Props {
  question: RaceQuestion;
  quiz: Pick<RallyQuiz, 'index' | 'questions' | 'feedback' | 'picked' | 'firstTry'>;
  combo?: number;
  continueLabel?: string;
  onAnswer: (option: number) => void;
  onRetry: () => void;
  onContinue: () => void;
}

export function RallyQuizCard({ question, quiz, combo = 0, continueLabel = '继续驾驶', onAnswer, onRetry, onContinue }: Props) {
  const answered = quiz.feedback !== null;
  return <section className="rally-quiz-card" aria-labelledby="rally-question-title">
    <div className="rally-quiz-top">
      <span className="rally-quiz-kicker">知识补给站 · 停车答题</span>
      <div className="rally-quiz-dots" aria-label={`第 ${quiz.index + 1} 题，共 ${quiz.questions.length} 题`}>
        {quiz.questions.map((entry, index) => <i key={entry.id} className={index < quiz.index ? 'done' : index === quiz.index ? 'now' : ''} />)}
      </div>
    </div>
    <span className={`rally-subject${question.subject === 'chinese' ? ' chinese' : ''}`}>{question.subject === 'chinese' ? '语文 · ' : '数学 · '}{question.topic}</span>
    <h2 id="rally-question-title">{question.prompt}</h2>
    <div className="rally-options" role="group" aria-label="答案选项">
      {question.options.map((option, index) => {
        const correct = answered && index === question.answer;
        const wrong = quiz.feedback === 'wrong' && index === quiz.picked;
        return <button
          key={`${question.id}-${option}`}
          className={`rally-option${correct ? ' correct' : ''}${wrong ? ' wrong' : ''}`}
          disabled={answered}
          onClick={() => onAnswer(index)}
        >
          <span className="key">{String.fromCharCode(65 + index)}</span><span>{option}</span>
        </button>;
      })}
    </div>

    {quiz.feedback && <div className={`rally-feedback${quiz.feedback === 'correct' ? ' good' : ' bad'}`} role="status" aria-live="polite">
      <strong>{quiz.feedback === 'correct' ? (combo >= 3 ? `漂亮！${combo} 连击，氮气正在积攒` : '回答正确，继续向前！') : '差一点，看懂解析再试一次'}</strong>
      <p>{question.explain}</p>
      <div className="rally-feedback-foot">
        <span>{quiz.feedback === 'correct' ? (quiz.firstTry ? '首次答对：更多能量与连击积分' : '重试成功：这道题已经掌握') : '答错不扣耐久，重试也能继续闯关'}</span>
        <button className={`rally-btn small ${quiz.feedback === 'correct' ? 'primary' : 'mint'}`} onClick={quiz.feedback === 'correct' ? onContinue : onRetry}>
          {quiz.feedback === 'correct' ? (quiz.index + 1 === quiz.questions.length ? continueLabel : '下一题') : '我再试一次'}
        </button>
      </div>
    </div>}
    {!answered && <p className="rally-quiz-tip">键盘 1–4 选择答案 · 答错后先读解析，再试一次</p>}
  </section>;
}
