
import { useEffect, useState } from 'react';
import apiRequest from '../services/api';

function Dashboard({ user, onNavigate }) {
  const [projection, setProjection] = useState(null);
const [installments, setInstallments] = useState([]);

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Load financial records from the backend
  const loadDashboardData = async () => {
    try {
        setDashboardLoading(true);
        setDashboardError('');

        const [projectionResponse, installmentResponse] =
        await Promise.all([
            apiRequest('/api/projection'),
            apiRequest('/api/installments'),
        ]);

        if (!projectionResponse.data) {
        throw new Error('Financial projection data is unavailable.');
        }

        setProjection(projectionResponse.data);
        setInstallments(installmentResponse.data || []);
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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

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
                <span>Total Allowances</span>
                <span className="card-icon purple">₱</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(totalAllowances)}
              </h2>
              <p>Available income</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Total Expenses</span>
                <span className="card-icon orange">↗</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(totalExpenses)}
              </h2>
              <p>Recorded expenses</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Upcoming Installments</span>
                <span className="card-icon blue">▤</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(remainingInstallments)}
              </h2>
              <p>Remaining unpaid payments</p>
            </div>

            <div className="summary-card">
              <div className="card-heading">
                <span>Projected Balance</span>
                <span className="card-icon green">₱</span>
              </div>
              <h2>
                {dashboardLoading
                  ? 'Loading...'
                  : formatCurrency(projectedBalance)}
              </h2>
              <p>Estimated remaining balance</p>
            </div>
          </section>

          <section className="content-grid">
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
                        const dueDate =
                          item.nextDueDate || item.dueDate;

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
                              <span className="status pending">
                                {item.status === 'partially_paid'
                                  ? 'Partially Paid'
                                  : 'Pending'}
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
                <strong>{formatCurrency(openingBalance)}</strong>
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
          </section>
        </>
      )}

      <footer className="footer">
        DueWise · BNPL Payment Projection System
      </footer>
    </>
  );
}

export default Dashboard;
