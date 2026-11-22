
import { useEffect, useState } from 'react';
import apiRequest from '../services/api';

function Dashboard({ user, onNavigate }) {
  const [projection, setProjection] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [allowanceRecords, setAllowanceRecords] = useState([]);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [isCalendarDetailsOpen, setIsCalendarDetailsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  );

  const [expenses, setExpenses] = useState([]);

  // Load financial records from the backend
  const loadDashboardData = async () => {
    try {
        setDashboardLoading(true);
        setDashboardError('');

        const [
          projectionResponse,
          installmentResponse,
          transactionResponse,
          expenseResponse,
          allowanceResponse,
        ] = await Promise.all([
          apiRequest('/api/projection'),
          apiRequest('/api/installments'),
          apiRequest('/api/transactions'),
          apiRequest('/api/expenses'),
          apiRequest('/api/allowances'),
        ]);

        if (!projectionResponse.data) {
        throw new Error('Financial projection data is unavailable.');
        }

        setProjection(projectionResponse.data);
        setInstallments(installmentResponse.data || []);
        setTransactions(transactionResponse.data || []);
        setExpenses(expenseResponse.data || []);
        setAllowanceRecords(allowanceResponse.data || []);
    } catch (error) {
        setDashboardError(
        error.message || 'Unable to load dashboard information.'
        );
    } finally {
        setDashboardLoading(false);
    }
    };

  // Load data whenever the Dashboard is opened
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Use the centralized financial projection calculations
    const summary = projection?.summary;

    const totalAllowances = Number(summary?.totalReceived || 0);

    const totalExpenses = Number(summary?.totalExpenses || 0);

    const remainingInstallments = Number(
    summary?.remainingBNPLBalance || 0
    );

    const openingBalance = Number(
    summary?.startingBalance || 0
    );

    const actualBalance = Number(
    summary?.actualBalance || 0
    );

    const projectedBalance = Number(
    summary?.projectedBalance || 0
    );

    const reserveLimit = Number(summary?.reserveLimit || 0);

    // Dashboard monthly figures use the current calendar month in Philippines time.
    const currentMonthKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());

    const currentMonthLabel = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const monthlyAllowances = allowanceRecords
      .filter((item) => String(item.dateReceived || '').slice(0, 7) === currentMonthKey)
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const monthlyExpenses = expenses
      .filter((item) => String(item.date || '').slice(0, 7) === currentMonthKey)
      .reduce((total, item) => total + Number(item.amount || 0), 0);

    const totalCategoryExpenses = expenses.reduce(
  (total, expense) => total + Number(expense.amount || 0),
  0
);

const spendingByCategory = Object.values(
  expenses.reduce((groups, expense) => {
    const category = expense.category || 'Others';
    const amount = Number(expense.amount || 0);

    if (!groups[category]) {
      groups[category] = {
        category,
        amount: 0,
      };
    }

    groups[category].amount += amount;

    return groups;
  }, {})
)
  .map((item) => ({
    ...item,
    percentage:
      totalCategoryExpenses > 0
        ? (item.amount / totalCategoryExpenses) * 100
        : 0,
  }))
  .sort((a, b) => b.amount - a.amount);

  const categoryChartColors = [
  '#6754e8',
  '#a78bfa',
  '#38bdf8',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#94a3b8',
];

const spendingChartSegments = spendingByCategory.reduce(
  (segments, item, index) => {
    const start = segments.length > 0
      ? segments[segments.length - 1].end
      : 0;

    const end = start + item.percentage;

    segments.push({
      category: item.category,
      amount: item.amount,
      percentage: item.percentage,
      color: categoryChartColors[index % categoryChartColors.length],
      start,
      end,
    });

    return segments;
  },
  []
);

const spendingChartGradient = spendingChartSegments.length
  ? `conic-gradient(${spendingChartSegments
      .map(
        (item) =>
          `${item.color} ${item.start}% ${item.end}%`
      )
      .join(', ')})`
  : '#eeeafc';

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  const getNextPaymentDate = (dateString, frequency) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (frequency === 'weekly') {
      date.setUTCDate(date.getUTCDate() + 7);
    } else if (frequency === 'biweekly') {
      date.setUTCDate(date.getUTCDate() + 14);
    } else if (frequency === 'monthly') {
      const nextMonth = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
      );

      const lastDay = new Date(
        Date.UTC(
          nextMonth.getUTCFullYear(),
          nextMonth.getUTCMonth() + 1,
          0
        )
      ).getUTCDate();

      nextMonth.setUTCDate(Math.min(day, lastDay));

      return nextMonth.toISOString().slice(0, 10);
    } else {
      throw new Error('Unsupported installment payment frequency.');
    }

    return date.toISOString().slice(0, 10);
  };

    const monthlyInstallments = installments.reduce((total, item) => {
      if (item.status === 'paid') return total;

      const remainingPayments = Math.max(
        0,
        Number(item.totalPayments || 0) - Number(item.paidPayments || 0)
      );
      if (remainingPayments === 0) return total;

      let dueDate = String(item.nextDueDate || item.dueDate || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return total;

      let monthlyTotal = 0;
      for (let index = 0; index < remainingPayments; index++) {
        if (dueDate.slice(0, 7) === currentMonthKey) {
          monthlyTotal += Number(item.amountPerPayment || 0);
        }
        if (index < remainingPayments - 1) {
          dueDate = getNextPaymentDate(dueDate, item.paymentFrequency);
        }
      }
      return total + monthlyTotal;
    }, 0);


  const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCalendarDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startingDay = firstDay.getDay();

  return Array.from({ length: 42 }, (_, index) => {
    return new Date(year, month, index - startingDay + 1);
  });
};

const formatCalendarMonth = (date) => {
  return date.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  });
};

const calendarEvents = (() => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const paidEvents = transactions
    .filter(
      (transaction) =>
        transaction.recordType === 'installment_payment' &&
        transaction.status === 'paid'
    )
    .map((transaction) => ({
      date: String(
        transaction.activityDate || transaction.paidAt || ''
      ).slice(0, 10),
      title: transaction.description || 'Installment Payment',
      provider: transaction.provider || 'Unknown Provider',
      amount: Number(transaction.amount || 0),
      status: 'paid',
    }))
    .filter((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.date));

  const scheduledEvents = [];

  installments.forEach((installment) => {
    if (installment.status === 'paid') return;

    const totalPayments = Number(installment.totalPayments || 0);
    const paidPayments = Number(installment.paidPayments || 0);
    const remainingPayments = Math.max(
      0,
      totalPayments - paidPayments
    );

    if (remainingPayments === 0) return;

    let nextDueDate = String(
      installment.nextDueDate || installment.dueDate || ''
    ).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) return;

    for (let index = 0; index < remainingPayments; index++) {
      scheduledEvents.push({
        date: nextDueDate,
        title: installment.description || 'BNPL Payment',
        provider: installment.provider || 'Unknown Provider',
        amount: Number(installment.amountPerPayment || 0),
        status: nextDueDate < today ? 'overdue' : 'upcoming',
      });

      if (index < remainingPayments - 1) {
        const scheduledDate =
          nextDueDate < today ? today : nextDueDate;

        nextDueDate = getNextPaymentDate(
          scheduledDate,
          installment.paymentFrequency
        );
      }
    }
  });

  return [...paidEvents, ...scheduledEvents];
})();

  const upcomingInstallments = installments
    .filter((item) => {
      return (
        item.status !== 'paid' &&
        Number(item.paidPayments || 0) <
          Number(item.totalPayments || 0)
      );
    })
    .sort((a, b) => {
      const dateA = a.nextDueDate || a.dueDate;
      const dateB = b.nextDueDate || b.dueDate;

      return new Date(dateA) - new Date(dateB);
    })
    .slice(0, 5);

    const calendarDays = getCalendarDays(calendarDate);

    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const selectedDayEvents = calendarEvents.filter(
      (event) => event.date === selectedDate
    );

  return (
    <>
      <section className="welcome-section">
        <div>
          <h2>Welcome back, {user?.displayName || 'User'}!</h2>
          <p>Here's an overview of your financial activity.</p>
        </div>
        <span className="demo-label">LIVE DATA</span>
      </section>

      {dashboardError && (
        <div className="error-message" role="alert">
          <strong>Unable to load dashboard data.</strong>
          <p>{dashboardError}</p>
          <button
            className="text-button"
            onClick={loadDashboardData}
            disabled={dashboardLoading}
          >
            {dashboardLoading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {!dashboardError && (
        <>
          <section className="summary-grid">
            <div className="summary-card">
              <div className="card-heading">
                <span>Allowances This Month</span>
                <span className="card-icon purple">₱</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(monthlyAllowances)}
              </h2>
              <p>Received in {currentMonthLabel}</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Expenses This Month</span>
                <span className="card-icon orange">↗</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(monthlyExpenses)}
              </h2>
              <p>Recorded in {currentMonthLabel}</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Installments Due This Month</span>
                <span className="card-icon blue">▤</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(monthlyInstallments)}
              </h2>
              <p>Due in {currentMonthLabel}</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Projected Balance</span>
                <span className="card-icon green">₱</span>
              </div>

              <h2
                className={
                  projectedBalance < 0
                    ? 'balance-text-danger'
                    : projectedBalance < reserveLimit
                      ? 'balance-text-warning'
                      : 'balance-text-success'
                }
              >
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(projectedBalance)}
              </h2>

              <p>Estimated remaining balance</p>
            </div>
          </section>

          <section className="content-grid dashboard-top-grid">
            <div className="content-card">
              <div className="section-heading">
                <div>
                  <h3>Upcoming Installments</h3>
                  <p>Keep track of your remaining payments.</p>
                </div>

                <button
                  className="text-button"
                  onClick={() => onNavigate('Installments')}
                >
                  View all
                </button>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Payment</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboardLoading ? (
                      <tr>
                        <td colSpan="4">Loading installments...</td>
                      </tr>
                    ) : upcomingInstallments.length > 0 ? (
                      upcomingInstallments.map((item) => {
                        const dueDate = item.nextDueDate || item.dueDate;
                        const dueDateKey = String(dueDate || '').slice(0, 10);

                        const isOverdue = dueDateKey && dueDateKey < todayKey;

                        const statusClass = isOverdue
                          ? 'overdue'
                          : item.status === 'partially_paid'
                            ? 'partial'
                            : 'pending';

                        const statusLabel = isOverdue
                          ? 'Overdue'
                          : item.status === 'partially_paid'
                            ? 'Partially Paid'
                            : 'Pending';

                        return (
                          <tr key={item.id}>
                            <td>
                              {item.description || item.provider}
                            </td>
                            <td>
                              {dueDate
                                ? new Date(
                                    `${dueDate}T00:00:00`
                                  ).toLocaleDateString('en-PH', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : 'Not set'}
                            </td>
                            <td>
                              {formatCurrency(item.amountPerPayment)}
                            </td>
                            <td>
                              <span className={`status ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty-message">
                          No upcoming installments.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="content-card balance-card">
              <h3>Financial Overview</h3>
              <p>Your current financial summary.</p>

              <div className="balance-item">
                <span>Opening Balance</span>
                <strong
                  className={
                    projectedBalance < 0
                      ? 'balance-text-danger'
                      : projectedBalance < reserveLimit
                        ? 'balance-text-warning'
                        : 'balance-text-success'
                  }
                >
                  {formatCurrency(projectedBalance)}
                </strong>
              </div>

              <div className="balance-item">
                <span>Total Allowances</span>
                <strong className="positive">
                  + {formatCurrency(totalAllowances)}
                </strong>
              </div>

              <div className="balance-item">
                <span>Total Expenses</span>
                <strong className="negative">
                  - {formatCurrency(totalExpenses)}
                </strong>
              </div>

              <div className="balance-item">
                <span>Remaining Installments</span>
                <strong className="negative">
                  - {formatCurrency(remainingInstallments)}
                </strong>
              </div>

              <div className="balance-total">
                <span>Current Available Balance</span>
                <strong>{formatCurrency(actualBalance)}</strong>
                </div>
            </div>

            <section className="content-card category-breakdown">           
              <h3>Spending by Category</h3>
              <p>See how your expenses are distributed.</p>

              {dashboardLoading ? (
                <p>Loading spending data...</p>
              ) : spendingByCategory.length > 0 ? (
                <>
                  <div className="spending-donut-layout">
                    <div
                      className="spending-donut-chart"
                      style={{ background: spendingChartGradient }}
                      role="img"
                      aria-label="Doughnut chart showing spending by category"
                    >
                      <div className="spending-donut-center">
                        <strong>{formatCurrency(totalCategoryExpenses)}</strong>
                        <span>Total Spending</span>
                      </div>
                    </div>

                    <div className="spending-donut-legend">
                      {spendingChartSegments.map((item) => (
                        <div
                          className="spending-legend-item"
                          key={item.category}
                        >
                          <span
                            className="spending-legend-dot"
                            style={{ background: item.color }}
                          />

                          <div className="spending-legend-details">
                            <strong>{item.category}</strong>
                            <span>
                              {formatCurrency(item.amount)}
                              {' '}({item.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="empty-message">
                  No expense records available for category analysis.
                </p>
              )}

              {!dashboardLoading && spendingByCategory.length > 0 && (
                <div className="balance-total">
                  <span>Total Recorded Spending</span>
                  <strong>{formatCurrency(totalCategoryExpenses)}</strong>
                </div>
              )}
            </section>
          </section>

          <div className="dashboard-insights-grid">
          <section className="content-card dashboard-calendar">
          <div className="section-heading">
            <div>
              <h3>Payment Calendar</h3>
              <p>Track your paid, upcoming, and overdue payments.</p>
            </div>

            <div className="calendar-navigation">
              <button
                type="button"
                className="calendar-today-button"
                onClick={() => {
                  setCalendarDate(new Date());
                  setSelectedDate(todayKey);
                  setIsCalendarDetailsOpen(false);
                }}
              >
                Today
              </button>

              <button
                type="button"
                className="calendar-nav-button"
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                ‹
              </button>

              <strong>{formatCalendarMonth(calendarDate)}</strong>

              <button
                type="button"
                className="calendar-nav-button"
                onClick={() =>
                  setCalendarDate(
                    new Date(
                      calendarDate.getFullYear(),
                      calendarDate.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                ›
              </button>
            </div>
          </div>
          

          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
              (day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              )
            )}

            {calendarDays.map((day) => {
              const dateKey = getDateKey(day);
              const dayEvents = calendarEvents.filter(
                (event) => event.date === dateKey
              );

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={[
                    'calendar-day',
                    day.getMonth() !== calendarDate.getMonth()
                      ? 'outside-month'
                      : '',
                    dateKey === todayKey ? 'today' : '',
                    dateKey === selectedDate ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(dateKey);
                    setIsCalendarDetailsOpen(true);
                  }}
                >
                  <span>{day.getDate()}</span>

                  {dayEvents.length > 0 && (
                    <div className="calendar-event-dots">
                      {dayEvents.slice(0, 3).map((event, index) => (
                        <span
                          key={`${event.status}-${index}`}
                          className={`calendar-dot ${event.status}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span><i className="calendar-dot paid" /> Paid</span>
            <span><i className="calendar-dot upcoming" /> Upcoming</span>
            <span><i className="calendar-dot overdue" /> Overdue</span>
          </div>

          {isCalendarDetailsOpen && (
          <div className="calendar-modal-overlay">
            <div className="calendar-details-modal">
              <div className="calendar-modal-header">
                <div>
                  <h3>Payment Details</h3>
                  <p>
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                      'en-PH',
                      { month: 'long', day: 'numeric', year: 'numeric' }
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="calendar-modal-close"
                  onClick={() => setIsCalendarDetailsOpen(false)}
                >
                  ×
                </button>
              </div>

              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event, index) => (
                  <div
                    className="calendar-payment-item"
                    key={`${event.date}-${event.title}-${index}`}
                  >
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.provider}</p>
                    </div>

                    <div>
                      <strong>{formatCurrency(event.amount)}</strong>
                      <span className={`status ${event.status}`}>
                        {event.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-message">
                  No payments scheduled for this date.
                </p>
              )}
            </div>
          </div>
          
        )}
        </section>
        </div>
      </>
    )}

      <footer className="footer">
        DueWise · BNPL Payment Projection System
      </footer>
    </>
  );
}

export default Dashboard;
