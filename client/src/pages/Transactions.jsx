
import { useEffect, useMemo, useState } from 'react';
import {
  ReceiptText,
  Search,
  CheckCircle2,
  History,
} from 'lucide-react';
import apiRequest from '../services/api';

const filters = ['All', 'Installments', 'Allowances', 'Expenses'];
const statusFilters = ['All Statuses', 'Paid', 'Pending', 'Overdue'];

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All Statuses');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedTransactionId, setSelectedTransactionId] =
    useState(null);

    const selectedTransaction = transactions.find(
    (item) => item.id === selectedTransactionId
    );

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');

      const [transactionResult, installmentResult] =
        await Promise.all([
          apiRequest('/api/transactions'),
          apiRequest('/api/installments'),
        ]);

      setTransactions(transactionResult.data || []);
      setInstallments(installmentResult.data || []);
      console.log('Installment API data:', installmentResult.data);
      console.log('Historical summary source:', installmentResult.data?.map(item => ({
      id: item.id,
      status: item.status,
      totalAmount: item.totalAmount,
      paidPayments: item.paidPayments,
      amountPerPayment: item.amountPerPayment,
      })));
    } catch (err) {
      setError(err.message || 'Failed to load payment history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(amount) || 0);

  const formatDate = (date) => {
    if (!date) return 'Not available';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Not available';
    }

    return parsedDate.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate the amount already represented by real transactions.
  const recordedAmountByInstallment = useMemo(() => {
    return transactions.reduce((result, transaction) => {
      if (
        transaction.recordType === 'installment_payment' &&
        transaction.status === 'paid' &&
        transaction.installmentId
    ) {
        result[transaction.installmentId] =
          (result[transaction.installmentId] || 0) +
          Number(transaction.amount || 0);
      }

      return result;
    }, {});
  }, [transactions]);

  // Calculate paid installment amounts without matching transactions.
  const historicalSummary = useMemo(() => {
    const records = installments
      .map((item) => {
        const paidPayments = Math.max(
          0,
          Number(item.paidPayments || 0)
        );

        const amountPerPayment = Number(
          item.amountPerPayment || 0
        );

        const totalAmount = Number(item.totalAmount || 0);

        const estimatedPaidAmount =
          item.status === 'paid'
            ? totalAmount
            : paidPayments * amountPerPayment;

        const recordedAmount =
          recordedAmountByInstallment[item.id] || 0;

        const untrackedAmount = Math.max(
          0,
          estimatedPaidAmount - recordedAmount
        );

        return {
          id: item.id,
          amount: untrackedAmount,
        };
      })
      .filter((item) => item.amount > 0.009);

    return {
      count: records.length,
      total: records.reduce(
        (sum, item) => sum + item.amount,
        0
      ),
    };
  }, [installments, recordedAmountByInstallment]);

  
    const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
        // Activity category filter
        const matchesCategory =
        activeFilter === 'All' ||
        (activeFilter === 'Installments' &&
            transaction.activityType === 'bnpl') ||
        (activeFilter === 'Allowances' &&
            transaction.activityType === 'income') ||
        (activeFilter === 'Expenses' &&
            transaction.activityType === 'expense');

        // Payment status filter
        const status = transaction.status?.toLowerCase();

        const matchesStatus =
        activeStatus === 'All Statuses' ||
        (activeStatus === 'Paid' &&
            ['paid', 'completed'].includes(status)) ||
        (activeStatus === 'Pending' &&
            ['pending', 'scheduled'].includes(status)) ||
        (activeStatus === 'Overdue' && status === 'overdue');

        // Search filter
        const matchesSearch = [
        transaction.description,
        transaction.provider,
        transaction.category,
        ]
        .filter(Boolean)
        .some((value) =>
            value.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return matchesCategory && matchesStatus && matchesSearch;
    });
    }, [transactions, activeFilter, activeStatus, searchTerm]);

  const totalPaid = transactions
    .filter(
        (item) =>
        item.recordType === 'installment_payment' &&
        item.status === 'paid'
    )
    .reduce(
        (total, item) => total + Number(item.amount || 0),
        0
    );

  return (
    <div className="transactions-page">
      <section className="summary-grid">
        <div className="summary-card">
          <div className="card-heading">
            <span>Total Transactions</span>
            <ReceiptText size={20} />
          </div>
          <h2>{transactions.length}</h2>
          <p>All financial activities</p>
        </div>

        <div className="summary-card">
          <div className="card-heading">
            <span>Total Paid</span>
            <CheckCircle2 size={20} />
          </div>
          <h2>{formatCurrency(totalPaid)}</h2>
          <p>Confirmed payments only</p>
        </div>

        
        <div className="summary-card historical-card">
        <div className="card-heading">
            <span>Historical Payments</span>
            <History size={20} />
        </div>

        <h2>{formatCurrency(historicalSummary.total)}</h2>

        <p>
            Estimated payments from older installment records
        </p>

        <div className="historical-card-footer">
            <span>
            {historicalSummary.count} unverified installment records
            </span>
            <span className="historical-badge">ESTIMATED</span>
        </div>
        </div>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <div>
            <h3>Financial History</h3>
            <p>Monitor your confirmed payments and financial activity.</p>
          </div>
        </div>

        {historicalSummary.total > 0 && !loading && (
          <div className="info-message">
            <strong>Historical payment information</strong>
            <p>
              Some paid installment amounts do not have matching
              transaction records. They are shown separately and
              are not treated as new transactions or deducted
              again from your balance.
            </p>
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            <button
              className="text-button"
              onClick={loadTransactions}
              disabled={loading}
            >
              Try Again
            </button>
          </div>
        )}

        
        <div className="filter-group">
        <small className="filter-label">ACTIVITY TYPE</small>
        <div className="transaction-filters">
            {filters.map((filter) => (
            <button
                key={filter}
                className={`filter-button ${
                activeFilter === filter ? 'active' : ''
                }`}
                onClick={() => {
                setActiveFilter(filter);
                setActiveStatus('All Statuses');
                setSelectedTransactionId(null);
                }}
            >
                {filter}
            </button>
            ))}
        </div>
        </div>

        {activeFilter === 'Installments' && (
        <div className="filter-group">
            <small className="filter-label">PAYMENT STATUS</small>

            <div className="transaction-filters">
            {['All Statuses', 'Paid', 'Pending', 'Overdue'].map(
                (filter) => (
                <button
                    key={filter}
                    className={`filter-button ${
                    activeStatus === filter ? 'active' : ''
                    }`}
                    onClick={() => {
                    setActiveStatus(filter);
                    setSelectedTransactionId(null);
                    }}
                >
                    {filter}
                </button>
                )
            )}
            </div>
        </div>
        )}

        <div className="transaction-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        
<div className="installment-record-layout transaction-record-layout">
  {/* LEFT: TRANSACTION RECORDS */}
  <div className="installment-record-list">
    <h3>Financial Activity</h3>

    <div className="installment-record-items">
      {loading ? (
        <p>Loading transactions...</p>
      ) : !error && filteredTransactions.length > 0 ? (
        filteredTransactions.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`installment-record-item ${
              selectedTransactionId === item.id ? 'active' : ''
            }`}
            onClick={() => setSelectedTransactionId(item.id)}
          >
            
            
            <span>
            <strong>{item.description || 'Financial Activity'}</strong>
            <br />
            <small className={`activity-type ${item.activityType || ''}`}>
                {item.activityType === 'bnpl'
                ? 'Installment'
                : item.activityType === 'income'
                ? 'Allowance'
                : item.activityType === 'expense'
                ? 'Expense'
                : 'Other'}
            </small>
            </span>

            <span>
            <span
                className={`status ${
                item.status === 'paid' || item.status === 'completed'
                    ? 'paid'
                    : item.status
                }`}
            >
                {item.status === 'paid'
                ? 'Paid'
                : item.status === 'scheduled'
                ? 'Scheduled'
                : item.status === 'completed'
                ? 'Completed'
                : item.status?.charAt(0).toUpperCase() +
                    item.status?.slice(1)}
            </span>
            </span>

          </button>
        ))
      ) : !error ? (
        <p className="empty-message">No transactions found.</p>
      ) : null}
    </div>
  </div>

  {/* RIGHT: SELECTED TRANSACTION DETAILS */}
  <div className="installment-record-details">
    {selectedTransaction ? (
      <>
        <h3>Activity Details</h3>

        
        <div className="receipt-details">
        <p className="receipt-label">ACTIVITY TYPE</p>
        <strong>
            {selectedTransaction.recordType === 'installment_plan'
            ? 'Installment Plan'
            : selectedTransaction.recordType === 'installment_payment'
            ? 'Installment Payment'
            : selectedTransaction.recordType === 'allowance'
            ? 'Allowance'
            : 'Expense'}
        </strong>

        <p className="receipt-label">DESCRIPTION</p>
        <h2>{selectedTransaction.description}</h2>

        <hr />

        {selectedTransaction.recordType === 'installment_plan' ? (
            <>
            <p className="receipt-label">TOTAL INSTALLMENT AMOUNT</p>
            <h3>{formatCurrency(selectedTransaction.totalAmount)}</h3>

            <p className="receipt-label">AMOUNT PER PAYMENT</p>
            <strong>{formatCurrency(selectedTransaction.amountPerPayment)}</strong>

            <p className="receipt-label">PAYMENT PROGRESS</p>
            <strong>
                {selectedTransaction.paidPayments} of {selectedTransaction.totalPayments} payments
            </strong>

            <p className="receipt-label">ESTIMATED AMOUNT PAID</p>
            <strong>{formatCurrency(selectedTransaction.estimatedPaidAmount)}</strong>

            <p className="receipt-label">REMAINING BALANCE</p>
            <h3>{formatCurrency(selectedTransaction.remainingAmount)}</h3>

            <p className="receipt-label">NEXT DUE DATE</p>
            <strong>{formatDate(selectedTransaction.dueDate)}</strong>

            <p className="receipt-label">PAYMENT STATUS</p>
            <span className={`status ${selectedTransaction.status}`}>
                {selectedTransaction.status.toUpperCase()}
            </span>
            </>
        ) : selectedTransaction.recordType === 'installment_payment' ? (
            <>
            <p className="receipt-label">AMOUNT PAID</p>
            <h3>{formatCurrency(selectedTransaction.amount)}</h3>

            <p className="receipt-label">PROVIDER</p>
            <strong>{selectedTransaction.provider || 'Unknown Provider'}</strong>

            <p className="receipt-label">PAYMENT DATE</p>
            <strong>{formatDate(selectedTransaction.activityDate)}</strong>

            <p className="receipt-label">PAYMENT STATUS</p>
            <span className="status paid">PAID</span>

            <p className="receipt-label">TRANSACTION REFERENCE</p>
            <strong>{selectedTransaction.originalId}</strong>
            </>
        ) : (
            <>
            <p className="receipt-label">
                {selectedTransaction.recordType === 'allowance'
                ? 'AMOUNT RECEIVED'
                : 'AMOUNT SPENT'}
            </p>
            <h3>{formatCurrency(selectedTransaction.amount)}</h3>

            <p className="receipt-label">CATEGORY</p>
            <strong>{selectedTransaction.category}</strong>

            <p className="receipt-label">DATE</p>
            <strong>{formatDate(selectedTransaction.activityDate)}</strong>

            <p className="receipt-label">STATUS</p>
            <span className={`status ${selectedTransaction.status}`}>
                {selectedTransaction.status.toUpperCase()}
            </span>

            {selectedTransaction.details && (
                <>
                <p className="receipt-label">NOTES</p>
                <strong>{selectedTransaction.details}</strong>
                </>
            )}

            <p className="receipt-label">REFERENCE</p>
            <strong>{selectedTransaction.originalId}</strong>
            </>
        )}
        </div>

      </>
    ) : (
      <div className="empty-message">
        <ReceiptText size={38} strokeWidth={1.4} />
        <h3>No Transaction Selected</h3>
        <p>Select a payment record from the left to view its details.</p>
      </div>
    )}
  </div>
</div>

      </section>
    </div>
  );
}

export default Transactions;
