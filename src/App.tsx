
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Task {
  id: string;
  title: string;
  category: string;
  dueDate?: string;
  completed: boolean;
}


type StatusFilter = 'all' | 'open' | 'done';

interface TimerSnapshot {
  isRunning: boolean;
  isWorkSession: boolean;
  secondsRemaining: number;
  timestamp?: number;
}


const TASKS_STORAGE_KEY = 'studyPlanner:tasks';
const FILTER_STORAGE_KEY = 'studyPlanner:filters';
const TIMER_STORAGE_KEY = 'studyPlanner:timer';

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

const DEFAULT_FILTERS: { status: StatusFilter; category: string } = {
  status: 'all',
  category: 'all',
};

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDate = (value?: string) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return value;
  }
};

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getInitialTasks = (): Task[] => {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(TASKS_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Task[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to parse stored tasks', error);
    return [];
  }
};

const getInitialFilters = () => {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
  if (!stored) return DEFAULT_FILTERS;
  try {
    const parsed = JSON.parse(stored) as Partial<typeof DEFAULT_FILTERS>;
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch (error) {
    console.warn('Failed to parse stored filters', error);
    return DEFAULT_FILTERS;
  }
};

const getInitialTimer = (): TimerSnapshot => {
  const base: TimerSnapshot = {
    isRunning: false,
    isWorkSession: true,
    secondsRemaining: WORK_DURATION,
  };

  if (typeof window === 'undefined') return base;

  const stored = window.localStorage.getItem(TIMER_STORAGE_KEY);
  if (!stored) return base;

  try {
    const parsed = JSON.parse(stored) as TimerSnapshot;
    if (!parsed) return base;

    let { isRunning, isWorkSession, secondsRemaining } = parsed;
    const { timestamp } = parsed;

    if (isRunning && typeof timestamp === 'number') {
      const elapsed = Math.floor((Date.now() - timestamp) / 1000);
      if (elapsed > 0) {
        const remaining = secondsRemaining - elapsed;
        if (remaining > 0) {
          secondsRemaining = remaining;
        } else {
          const nextIsWorkSession = !isWorkSession;
          isWorkSession = nextIsWorkSession;
          secondsRemaining = nextIsWorkSession ? WORK_DURATION : BREAK_DURATION;
          isRunning = false;
        }
      }
    }

    return {
      isRunning: isRunning && secondsRemaining > 0,
      isWorkSession,
      secondsRemaining,
    };
  } catch (error) {
    console.warn('Failed to parse stored timer', error);
    return base;
  }
};

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => getInitialTasks());
  const [filters, setFilters] = useState(() => getInitialFilters());
  const { status: filterStatus, category: categoryFilter } = filters;
  const [timer, setTimer] = useState<TimerSnapshot>(() => getInitialTimer());
  const [formState, setFormState] = useState({
    title: '',
    category: '',
    dueDate: '',
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    tasks.forEach((task) => {
      if (task.category) {
        unique.add(task.category);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'done'
          ? task.completed
          : !task.completed;
      const matchesCategory =
        categoryFilter === 'all' ? true : task.category === categoryFilter;
      return matchesStatus && matchesCategory;
    });
  }, [tasks, filterStatus, categoryFilter]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.completed).length,
    [tasks]
  );
  const openCount = tasks.length - completedCount;
  const completionPercentage = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  const chartData = useMemo(() => {
    if (tasks.length === 0) return [] as { name: string; completed: number }[];

    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      if (task.completed) {
        const key = task.category || 'General';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    });

    if (counts.size === 0) {
      return [{ name: 'No completions yet', completed: 0 }];
    }

    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      completed: value,
    }));
  }, [tasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify({ ...timer, timestamp: Date.now() })
    );
  }, [timer]);

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = window.setInterval(() => {
      setTimer((prev) => {
        if (!prev.isRunning) {
          return prev;
        }

        if (prev.secondsRemaining <= 1) {
          const nextIsWorkSession = !prev.isWorkSession;
          return {
            isRunning: false,
            isWorkSession: nextIsWorkSession,
            secondsRemaining:
              nextIsWorkSession ? WORK_DURATION : BREAK_DURATION,
          };
        }

        return {
          ...prev,
          secondsRemaining: prev.secondsRemaining - 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer.isRunning, timer.isWorkSession]);

  useEffect(() => {
    if (!editingTaskId) return;
    const task = tasks.find((item) => item.id === editingTaskId);
    if (!task) return;
    setFormState({
      title: task.title,
      category: task.category,
      dueDate: task.dueDate ?? '',
    });
  }, [editingTaskId, tasks]);

  const resetForm = () => {
    setFormState({ title: '', category: '', dueDate: '' });
    setEditingTaskId(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) return;
    if (!formState.category.trim()) return;

    const normalizedTask: Task = {
      id: editingTaskId ?? createId(),
      title: formState.title.trim(),
      category: formState.category.trim(),
      dueDate: formState.dueDate ? formState.dueDate : undefined,
      completed: editingTaskId
        ? tasks.find((task) => task.id === editingTaskId)?.completed ?? false
        : false,
    };

    setTasks((prev) => {
      if (editingTaskId) {
        return prev.map((task) => (task.id === editingTaskId ? normalizedTask : task));
      }
      return [normalizedTask, ...prev];
    });

    resetForm();
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    if (editingTaskId === id) {
      resetForm();
    }
  };

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleStartPause = () => {
    setTimer((prev) => {
      const shouldStart = !prev.isRunning;
      return {
        ...prev,
        isRunning: shouldStart,
        secondsRemaining:
          prev.secondsRemaining === 0
            ? prev.isWorkSession
              ? WORK_DURATION
              : BREAK_DURATION
            : prev.secondsRemaining,
      };
    });
  };

  const handleResetTimer = () => {
    setTimer({
      isRunning: false,
      isWorkSession: true,
      secondsRemaining: WORK_DURATION,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 lg:px-8">
        <header className="rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl shadow-slate-900/40 backdrop-blur">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Study Planner
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-300 sm:text-lg">
            Organise your study sessions, track your progress across subjects,
            and stay focused with the built-in Pomodoro timer.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/60 p-4 text-sm shadow-inner shadow-slate-950/40">
              <p className="text-slate-400">Open tasks</p>
              <p className="mt-1 text-2xl font-semibold text-white">{openCount}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-4 text-sm shadow-inner shadow-slate-950/40">
              <p className="text-slate-400">Completed tasks</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">
                {completedCount}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-4 text-sm shadow-inner shadow-slate-950/40">
              <p className="text-slate-400">Overall progress</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-400"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-white">
                {completionPercentage}%
              </p>
            </div>
          </div>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  {editingTaskId ? 'Update task' : 'Add a new task'}
                </h2>
                {editingTaskId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm font-medium text-sky-300 transition hover:text-sky-200"
                  >
                    Cancel editing
                  </button>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col text-sm font-medium text-slate-300">
                    Title
                    <input
                      required
                      type="text"
                      value={formState.title}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          title: event.target.value,
                        }))
                      }
                      placeholder="e.g. Revise algebra chapter 3"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-slate-300">
                    Category
                    <input
                      required
                      list="category-options"
                      type="text"
                      value={formState.category}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          category: event.target.value,
                        }))
                      }
                      placeholder="e.g. Mathematics"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                    <datalist id="category-options">
                      {categories.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <label className="flex flex-1 flex-col text-sm font-medium text-slate-300">
                    Due date (optional)
                    <input
                      type="date"
                      value={formState.dueDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          dueDate: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 via-sky-400 to-emerald-400 px-6 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:shadow-sky-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    {editingTaskId ? 'Save changes' : 'Add task'}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  Task list
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  {(['all', 'open', 'done'] as StatusFilter[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({ ...prev, status }))
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-400/60 ${
                        filterStatus === status
                          ? 'bg-sky-500/20 text-sky-200'
                          : 'bg-slate-950/40 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {status === 'all'
                        ? 'All'
                        : status === 'open'
                        ? 'Open'
                        : 'Done'}
                    </button>
                  ))}
                  <select
                    value={categoryFilter}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                    className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-sm text-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  >
                    <option value="all">All categories</option>
                    {categories.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {filteredTasks.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                    No tasks to show yet. Add your first task or adjust the
                    filters above.
                  </p>
                ) : (
                  filteredTasks.map((task) => {
                    const dueDate = formatDate(task.dueDate);
                    return (
                      <article
                        key={task.id}
                        className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-5 shadow-inner shadow-slate-950/60 transition hover:border-sky-400/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggle(task.id)}
                              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                task.completed
                                  ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                                  : 'border-white/20 bg-transparent text-slate-400 hover:border-sky-300'
                              }`}
                              aria-label={
                                task.completed ? 'Mark as open' : 'Mark as done'
                              }
                            >
                              {task.completed ? '✓' : ''}
                            </button>
                            <h3
                              className={`text-lg font-semibold ${
                                task.completed
                                  ? 'text-slate-400 line-through'
                                  : 'text-white'
                              }`}
                            >
                              {task.title}
                            </h3>
                            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-sky-200">
                              {task.category}
                            </span>
                          </div>
                          {dueDate && (
                            <p className="text-sm text-slate-400">
                              Due {dueDate}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(task)}
                            className="rounded-full border border-transparent bg-slate-900/70 px-4 py-2 text-sm font-medium text-sky-200 transition hover:border-sky-400/40 hover:text-sky-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="rounded-full border border-transparent bg-slate-900/70 px-4 py-2 text-sm font-medium text-rose-200 transition hover:border-rose-400/40 hover:text-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                Pomodoro timer
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {timer.isWorkSession
                  ? 'Focus time — stay on task for 25 minutes.'
                  : 'Take a short 5 minute break to recharge.'}
              </p>
              <div className="mt-6 flex flex-col items-center gap-6 text-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-full border border-sky-400/30 bg-slate-950/40 text-4xl font-bold tracking-wider text-sky-200 shadow-inner shadow-sky-500/20">
                  {formatTime(timer.secondsRemaining)}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleStartPause}
                    className="rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:shadow-sky-400/40"
                  >
                    {timer.isRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetTimer}
                    className="rounded-full border border-white/10 bg-slate-950/60 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400/40 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  Progress by category
                </h2>
                <span className="text-sm text-slate-400">
                  Completed tasks
                </span>
              </div>
              <div className="mt-6 h-64">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                    Complete some tasks to see your progress visualised here.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#cbd5f5', fontSize: 12 }} />
                      <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: '#cbd5f5', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(56, 189, 248, 0.12)' }}
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          borderRadius: '0.75rem',
                          border: '1px solid rgba(148, 163, 184, 0.3)',
                          color: '#e2e8f0',
                        }}
                      />
                      <Bar dataKey="completed" fill="url(#colorCompleted)" radius={[12, 12, 12, 12]} />
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
