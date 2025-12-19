import React, { useEffect, useState, useContext, useCallback } from 'react';
import styled from 'styled-components';
import { Card, Button, Table, Tag, Spin, message, Tooltip, Progress } from 'antd';
import {
  WalletOutlined,
  DollarOutlined,
  HistoryOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { AuthContext } from 'context/AuthProvider';

// Format EURC amount to 6 decimal places without floating point errors
const formatEURC = (value) => {
  if (!value && value !== 0) return '0.000000';
  const str = String(value);

  // If already has decimal, pad/truncate to 6 places
  if (str.includes('.')) {
    const [whole, decimal] = str.split('.');
    return `${whole}.${decimal.padEnd(6, '0').slice(0, 6)}`;
  }

  // No decimal, add .000000
  return `${str}.000000`;
};

const PageWrapper = styled.div`
  max-width: 1200px;
  margin: 40px auto;
  padding: 20px;
`;

const PageTitle = styled.h1`
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
`;

const PageSubtitle = styled.p`
  color: #666;
  margin-bottom: 32px;
  font-size: 16px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled(Card)`
  .ant-card-body {
    padding: 24px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    font-size: 24px;
  }

  .stat-label {
    color: #666;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .stat-subtitle {
    color: #888;
    font-size: 12px;
    margin-top: 4px;
  }
`;

const WalletCard = styled(Card)`
  margin-bottom: 24px;

  .wallet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .wallet-address {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f5f5f5;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 14px;
  }

  .wallet-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wallet-benefits {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #f0f0f0;
  }

  .benefit-item {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #666;
    font-size: 14px;

    .benefit-icon {
      color: #52c41a;
      font-size: 18px;
    }
  }
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EscrowCard = styled(Card)`
  margin-bottom: 24px;
  background: linear-gradient(135deg, #F18881 0%, #FBC82F 100%);

  .ant-card-body {
    padding: 24px;
  }

  .escrow-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    color: white;
  }

  .escrow-amount {
    font-size: 36px;
    font-weight: 700;
    color: white;
    margin: 8px 0;
  }

  .escrow-label {
    font-size: 14px;
    opacity: 0.9;
    color: white;
  }

  .escrow-info {
    text-align: right;
    color: white;
  }

  .escrow-count {
    font-size: 24px;
    font-weight: 600;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px;
  color: #666;

  .empty-icon {
    font-size: 48px;
    color: #ccc;
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    margin-bottom: 8px;
    color: #1a1a1a;
  }

  p {
    margin-bottom: 16px;
  }
`;

const WithdrawSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  margin-bottom: 24px;

  .withdraw-info {
    h3 {
      margin: 0 0 4px;
      font-size: 16px;
      color: #1a1a1a;
    }
    p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  }
`;

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:3000';

const HostWalletPage = () => {
  const { user, loggedIn } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [payoutStatus, setPayoutStatus] = useState(null);
  const [escrowData, setEscrowData] = useState(null);
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

  const userId = user?.id;

  // Fetch wallet data
  const fetchWalletData = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${backendBaseUrl}/api/host/wallet/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setWalletData(data);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  }, [userId]);

  // Fetch payout status
  const fetchPayoutStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${backendBaseUrl}/api/payouts/status/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPayoutStatus(data);
      }
    } catch (error) {
      console.error('Error fetching payout status:', error);
    }
  }, [userId]);

  // Fetch escrow data
  const fetchEscrowData = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${backendBaseUrl}/api/payouts/escrow/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setEscrowData(data);
      }
    } catch (error) {
      console.error('Error fetching escrow data:', error);
    }
  }, [userId]);

  // Fetch payout history
  const fetchPayoutHistory = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`${backendBaseUrl}/api/payouts/history/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPayoutHistory(data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching payout history:', error);
    }
  }, [userId]);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchWalletData(),
        fetchPayoutStatus(),
        fetchEscrowData(),
        fetchPayoutHistory(),
      ]);
      setLoading(false);
    };

    if (userId) {
      loadData();
    }
  }, [userId, fetchWalletData, fetchPayoutStatus, fetchEscrowData, fetchPayoutHistory]);

  // Create CDP wallet and set preference
  const handleCreateWallet = async () => {
    setCreatingWallet(true);
    try {
      // Create wallet
      const createResponse = await fetch(`${backendBaseUrl}/api/host/wallet/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create wallet');
      }

      const walletResult = await createResponse.json();

      // Auto-set preference to CDP wallet
      await fetch(`${backendBaseUrl}/api/payouts/preference/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutPreference: 'cdp_wallet' }),
      });

      message.success('Wallet created successfully! Payouts will be sent here automatically.');
      setWalletData(walletResult);
      fetchPayoutStatus();
    } catch (error) {
      message.error(error.message || 'Error creating wallet');
    } finally {
      setCreatingWallet(false);
    }
  };

  // Trigger manual payout
  const handleManualPayout = async () => {
    if (!walletData?.address) {
      message.warning('Please create a wallet first');
      return;
    }

    setProcessingPayout(true);
    try {
      const response = await fetch(`${backendBaseUrl}/api/payouts/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success(`${data.amount} EURC transferred to your wallet!`);
        fetchPayoutStatus();
        fetchPayoutHistory();
      } else {
        message.error(data.error || 'Withdrawal failed');
      }
    } catch (error) {
      message.error('Error processing withdrawal');
    } finally {
      setProcessingPayout(false);
    }
  };

  // Copy address to clipboard
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    message.success('Address copied to clipboard');
  };

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // Escrow bookings table columns
  const escrowColumns = [
    {
      title: 'Property',
      dataIndex: 'propertyTitle',
      key: 'propertyTitle',
      ellipsis: true,
    },
    {
      title: 'Check-in',
      dataIndex: 'checkIn',
      key: 'checkIn',
    },
    {
      title: 'Check-out',
      dataIndex: 'checkOut',
      key: 'checkOut',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          Upcoming: 'blue',
          Active: 'green',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Your Earnings',
      dataIndex: 'hostAmount',
      key: 'hostAmount',
      render: (amount) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          {formatEURC(amount)} EURC
        </span>
      ),
    },
  ];

  // Payout history table columns
  const historyColumns = [
    {
      title: 'Property',
      dataIndex: 'propertyTitle',
      key: 'propertyTitle',
      ellipsis: true,
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, record) => (
        <span>
          {record.checkIn} - {record.checkOut}
        </span>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'payoutAmount',
      key: 'payoutAmount',
      render: (amount) => (
        <span style={{ fontWeight: 600 }}>
          {amount ? `${formatEURC(amount)} EURC` : '-'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'payoutStatus',
      key: 'payoutStatus',
      render: (status) => {
        const colors = {
          completed: 'green',
          pending: 'orange',
          processing: 'blue',
          failed: 'red',
        };
        return <Tag color={colors[status] || 'default'}>{status?.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'payoutDate',
      key: 'payoutDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Transaction',
      dataIndex: 'payoutTxHash',
      key: 'payoutTxHash',
      render: (hash) => hash ? (
        <a
          href={`https://sepolia.basescan.org/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {formatAddress(hash)}
        </a>
      ) : '-',
    },
  ];

  if (!loggedIn) {
    return (
      <PageWrapper>
        <EmptyState>
          <WalletOutlined className="empty-icon" />
          <h3>Please Sign In</h3>
          <p>You need to be logged in to view your wallet and payouts.</p>
        </EmptyState>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>Loading wallet data...</p>
        </div>
      </PageWrapper>
    );
  }

  const hasCDPWallet = walletData?.success && walletData?.address;
  const pendingBalance = parseFloat(payoutStatus?.pendingBalance || '0');
  const escrowBalance = parseFloat(escrowData?.escrowBalance || '0');
  const escrowBookings = escrowData?.bookings || [];
  const completedPayouts = payoutHistory.filter(p => p.payoutStatus === 'completed').length;

  return (
    <PageWrapper>
      <PageTitle>Wallet & Payouts</PageTitle>
      <PageSubtitle>
        Manage your earnings from property bookings. Funds are held securely in escrow until checkout.
      </PageSubtitle>

      {/* Escrow Card - Always show */}
      <EscrowCard>
        <div className="escrow-header">
          <div>
            <div className="escrow-label">
              <SafetyOutlined style={{ marginRight: 8 }} />
              In Escrow (Active Bookings)
            </div>
            <div className="escrow-amount">{formatEURC(escrowBalance)} EURC</div>
            <div className="escrow-label">
              Released automatically after guest checkout
            </div>
          </div>
          <div className="escrow-info">
            <div className="escrow-count">{escrowBookings.length}</div>
            <div className="escrow-label">Active Bookings</div>
          </div>
        </div>
      </EscrowCard>

      {/* Stats Cards */}
      <StatsGrid>
        <StatCard>
          <div className="stat-icon" style={{ background: '#f6ffed', color: '#52c41a' }}>
            <DollarOutlined />
          </div>
          <div className="stat-label">Available to Withdraw</div>
          <div className="stat-value">{formatEURC(pendingBalance)} EURC</div>
          <div className="stat-subtitle">Ready for instant withdrawal</div>
        </StatCard>

        <StatCard>
          <div className="stat-icon" style={{ background: '#e6f7ff', color: '#1890ff' }}>
            <WalletOutlined />
          </div>
          <div className="stat-label">CDP Wallet Balance</div>
          <div className="stat-value">
            {hasCDPWallet
              ? `${formatEURC(walletData.balances?.eurc || walletData.balances?.EURC || '0')} EURC`
              : '-'}
          </div>
          <div className="stat-subtitle">
            {hasCDPWallet ? 'Your payout wallet' : 'Create wallet to view'}
          </div>
        </StatCard>

        <StatCard>
          <div className="stat-icon" style={{ background: '#fff7e6', color: '#fa8c16' }}>
            <HistoryOutlined />
          </div>
          <div className="stat-label">Total Payouts</div>
          <div className="stat-value">{completedPayouts}</div>
          <div className="stat-subtitle">Successfully completed</div>
        </StatCard>
      </StatsGrid>

      {/* Withdraw Section - Only show if has balance and wallet */}
      {pendingBalance > 0 && hasCDPWallet && (
        <WithdrawSection>
          <div className="withdraw-info">
            <h3>Ready to Withdraw</h3>
            <p>Transfer {formatEURC(pendingBalance)} EURC to your wallet</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<SyncOutlined spin={processingPayout} />}
            loading={processingPayout}
            onClick={handleManualPayout}
          >
            Withdraw Now
          </Button>
        </WithdrawSection>
      )}

      {/* CDP Wallet Section */}
      <WalletCard
        title={
          <span>
            <WalletOutlined style={{ marginRight: 8 }} />
            Your Payout Wallet
          </span>
        }
      >
        {hasCDPWallet ? (
          <>
            <div className="wallet-header">
              <div className="wallet-status">
                <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
                <span style={{ color: '#666' }}>Powered by Coinbase</span>
              </div>
            </div>
            <div className="wallet-address">
              <span style={{ flex: 1 }}>{walletData.address}</span>
              <Tooltip title="Copy address">
                <Button
                  icon={<CopyOutlined />}
                  size="small"
                  onClick={() => copyAddress(walletData.address)}
                />
              </Tooltip>
              <Tooltip title="View on BaseScan">
                <Button
                  size="small"
                  onClick={() => window.open(`https://sepolia.basescan.org/address/${walletData.address}`, '_blank')}
                >
                  View
                </Button>
              </Tooltip>
            </div>
          </>
        ) : (
          <EmptyState>
            <WalletOutlined className="empty-icon" />
            <h3>Set Up Your Wallet</h3>
            <p>
              Create your payout wallet to receive earnings from bookings.
              Powered by Coinbase with zero gas fees and easy bank withdrawals.
            </p>
            <Button
              type="primary"
              size="large"
              icon={<WalletOutlined />}
              loading={creatingWallet}
              onClick={handleCreateWallet}
            >
              Create Wallet
            </Button>
          </EmptyState>
        )}
      </WalletCard>

      {/* Escrow Bookings */}
      {escrowBookings.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <SectionTitle>
            <ClockCircleOutlined />
            Upcoming Payouts
          </SectionTitle>
          <p style={{ color: '#666', marginBottom: 16 }}>
            These funds will be released to your wallet after each guest checks out.
          </p>
          <Table
            dataSource={escrowBookings}
            columns={escrowColumns}
            rowKey={(record) => record.bookingId || Math.random()}
            pagination={false}
          />
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <SectionTitle>
          <HistoryOutlined />
          Payout History
        </SectionTitle>

        {payoutHistory.length > 0 ? (
          <Table
            dataSource={payoutHistory}
            columns={historyColumns}
            rowKey={(record) => record.bookingId || Math.random()}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <EmptyState>
            <HistoryOutlined className="empty-icon" />
            <h3>No Payouts Yet</h3>
            <p>Your payout history will appear here once bookings are completed.</p>
          </EmptyState>
        )}
      </Card>
    </PageWrapper>
  );
};

export default HostWalletPage;
