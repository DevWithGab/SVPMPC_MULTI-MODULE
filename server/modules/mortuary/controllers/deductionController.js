const Member = require('../../../shared/models/Member');
const Ledger = require('../models/Ledger');
const { v4: uuidv4 } = require('uuid');

// Constants
const DEDUCTION_AMOUNT = 25; // 25 pesos per death
const MINIMUM_BALANCE = 1000; // 1000 pesos minimum balance

// Get all member balances
const getAllMemberBalances = async (req, res) => {
  try {
    // Get all active members with full details
    const members = await Member.find({ status: 'active' });
    
    const memberBalances = [];
    
    for (const member of members) {
      // Get latest balance for each member
      const latestLedger = await Ledger.findOne({ memberId: member.memberId })
        .sort({ transactionDate: -1 });
      
      const balance = latestLedger ? latestLedger.balance : 0;
      const isLowBalance = balance < MINIMUM_BALANCE;
      
      memberBalances.push({
        id: member.memberId, // Frontend expects 'id'
        memberId: member.memberId,
        name: member.memberName, // Frontend expects 'name'
        memberName: member.memberName,
        email: member.email,
        contact: member.phoneNumber, // Frontend expects 'contact'
        phoneNumber: member.phoneNumber,
        address: member.address,
        barangay: member.barangay,
        beneficiaries: member.beneficiaries,
        status: member.status,
        join_date: member.joinDate,
        balance: balance,
        isLowBalance: isLowBalance,
        lastUpdated: latestLedger ? latestLedger.transactionDate : null
      });
    }
    
    // Sort by balance (lowest first to highlight low balances)
    memberBalances.sort((a, b) => a.balance - b.balance);
    
    // Calculate summary statistics
    const totalBalance = memberBalances.reduce((sum, member) => sum + member.balance, 0);
    const lowBalanceCount = memberBalances.filter(member => member.isLowBalance).length;
    const averageBalance = memberBalances.length > 0 ? totalBalance / memberBalances.length : 0;
    
    res.status(200).json({
      success: true,
      data: {
        members: memberBalances,
        summary: {
          totalMembers: memberBalances.length,
          totalBalance: totalBalance,
          averageBalance: Math.round(averageBalance),
          lowBalanceCount: lowBalanceCount,
          minimumBalance: MINIMUM_BALANCE
        }
      }
    });
  } catch (error) {
    console.error('Error fetching member balances:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching member balances', 
      error: error.message 
    });
  }
};

// Process automatic deduction for all members (triggered when someone dies)
const processAutomaticDeduction = async (req, res) => {
  try {
    const { deceasedMemberName, recordedBy, customAmount } = req.body;
    
    if (!deceasedMemberName) {
      return res.status(400).json({
        success: false,
        message: 'Deceased member name is required'
      });
    }
    
    // Use custom amount if provided, otherwise use default
    const deductionAmount = customAmount ? parseFloat(customAmount) : DEDUCTION_AMOUNT;
    
    if (isNaN(deductionAmount) || deductionAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deduction amount'
      });
    }
    
    // Get all active members
    const members = await Member.find({ status: 'active' });
    
    const deductionResults = [];
    const lowBalanceMembers = [];
    
    for (const member of members) {
      try {
        // Get current balance
        const latestLedger = await Ledger.findOne({ memberId: member.memberId })
          .sort({ transactionDate: -1 });
        
        const currentBalance = latestLedger ? latestLedger.balance : 0;
        const newBalance = currentBalance - deductionAmount;
        
        // Create ledger entry for deduction
        const ledgerEntry = new Ledger({
          ledgerId: uuidv4(),
          memberId: member.memberId,
          transactionType: 'automatic_deduction',
          description: `Automatic deduction for death of ${deceasedMemberName}`,
          debit: deductionAmount,
          credit: 0,
          balance: newBalance,
          transactionDate: new Date(),
          recordedBy: recordedBy || 'system'
        });
        
        await ledgerEntry.save();
        
        const result = {
          memberId: member.memberId,
          memberName: member.memberName,
          phoneNumber: member.phoneNumber,
          previousBalance: currentBalance,
          newBalance: newBalance,
          deductionAmount: deductionAmount,
          isLowBalance: newBalance < MINIMUM_BALANCE
        };
        
        deductionResults.push(result);
        
        // Track members with low balance after deduction
        if (newBalance < MINIMUM_BALANCE) {
          lowBalanceMembers.push(result);
        }
        
      } catch (memberError) {
        console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
        deductionResults.push({
          memberId: member.memberId,
          memberName: member.memberName,
          error: memberError.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Automatic deduction processed for ${deductionResults.length} members`,
      data: {
        deceasedMemberName,
        deductionAmount: deductionAmount,
        processedMembers: deductionResults.length,
        lowBalanceMembers: lowBalanceMembers.length,
        deductionResults: deductionResults,
        lowBalanceList: lowBalanceMembers
      }
    });
    
  } catch (error) {
    console.error('Error processing automatic deduction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing automatic deduction', 
      error: error.message 
    });
  }
};

// Check for members with low balance
const checkLowBalanceMembers = async (req, res) => {
  try {
    const members = await Member.find({ status: 'active' }).select('memberId memberName phoneNumber');
    
    const lowBalanceMembers = [];
    
    for (const member of members) {
      const latestLedger = await Ledger.findOne({ memberId: member.memberId })
        .sort({ transactionDate: -1 });
      
      const balance = latestLedger ? latestLedger.balance : 0;
      
      if (balance < MINIMUM_BALANCE) {
        lowBalanceMembers.push({
          memberId: member.memberId,
          memberName: member.memberName,
          phoneNumber: member.phoneNumber,
          balance: balance,
          deficit: MINIMUM_BALANCE - balance,
          lastUpdated: latestLedger ? latestLedger.transactionDate : null
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        lowBalanceMembers: lowBalanceMembers,
        count: lowBalanceMembers.length,
        minimumBalance: MINIMUM_BALANCE
      }
    });
    
  } catch (error) {
    console.error('Error checking low balance members:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error checking low balance members', 
      error: error.message 
    });
  }
};

// Send SMS notifications to members with low balance
const sendLowBalanceNotifications = async (req, res) => {
  try {
    const { memberIds } = req.body; // Optional: specific member IDs, otherwise send to all low balance members
    
    let targetMembers = [];
    
    if (memberIds && memberIds.length > 0) {
      // Send to specific members
      const members = await Member.find({ 
        memberId: { $in: memberIds }, 
        status: 'active' 
      }).select('memberId memberName phoneNumber');
      
      for (const member of members) {
        const latestLedger = await Ledger.findOne({ memberId: member.memberId })
          .sort({ transactionDate: -1 });
        
        const balance = latestLedger ? latestLedger.balance : 0;
        
        if (balance < MINIMUM_BALANCE) {
          targetMembers.push({
            ...member.toObject(),
            balance: balance,
            deficit: MINIMUM_BALANCE - balance
          });
        }
      }
    } else {
      // Send to all low balance members
      const members = await Member.find({ status: 'active' }).select('memberId memberName phoneNumber');
      
      for (const member of members) {
        const latestLedger = await Ledger.findOne({ memberId: member.memberId })
          .sort({ transactionDate: -1 });
        
        const balance = latestLedger ? latestLedger.balance : 0;
        
        if (balance < MINIMUM_BALANCE) {
          targetMembers.push({
            ...member.toObject(),
            balance: balance,
            deficit: MINIMUM_BALANCE - balance
          });
        }
      }
    }
    
    // TODO: Integrate with SMS service
    // For now, we'll just return the members who should receive notifications
    const notifications = targetMembers.map(member => ({
      memberId: member.memberId,
      memberName: member.memberName,
      phoneNumber: member.phoneNumber,
      balance: member.balance,
      deficit: member.deficit,
      message: `Dear ${member.memberName}, your mortuary fund balance is ₱${member.balance.toLocaleString()}, which is below the minimum required balance of ₱${MINIMUM_BALANCE.toLocaleString()}. Please make a contribution of at least ₱${member.deficit.toLocaleString()} to maintain your account in good standing.`,
      status: 'pending' // Would be 'sent' when SMS service is integrated
    }));
    
    res.status(200).json({
      success: true,
      message: `Low balance notifications prepared for ${notifications.length} members`,
      data: {
        notifications: notifications,
        count: notifications.length,
        minimumBalance: MINIMUM_BALANCE
      }
    });
    
  } catch (error) {
    console.error('Error sending low balance notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending low balance notifications', 
      error: error.message 
    });
  }
};

module.exports = {
  getAllMemberBalances,
  processAutomaticDeduction,
  checkLowBalanceMembers,
  sendLowBalanceNotifications
};