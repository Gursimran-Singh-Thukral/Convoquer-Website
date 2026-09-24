'use client';
import { useEffect, useState } from 'react';
import { PublicPage } from '@/components/PublicPage';
import { apiGet } from '@/lib/api';
type Question = { id: string; title: string; body: string };
export default function FAQPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    apiGet<Question[]>('/content?kind=FAQ')
      .then(setQuestions)
      .catch(() => setError('Questions could not be loaded. Please try again.'))
      .finally(() => setLoading(false));
  }, []);
  return (
    <PublicPage title="Frequently asked questions">
      {loading ? (
        <p>Loading questions…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !questions.length ? (
        <p>Official answers will appear here once published by the organizing team.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <details
              key={question.id}
              className="rounded-xl border border-white/15 bg-[#1B191E] p-6"
            >
              <summary className="cursor-pointer font-semibold text-[#FFD700]">
                {question.title}
              </summary>
              <p className="mt-4 text-gray-300 whitespace-pre-wrap">{question.body}</p>
            </details>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
