/* Treasurer-side claim processing.

Hiniwalay ito sa sarili nitong file, bukod sa deductionController.js, para manatiling
klaro at distinct sa codebase yung dalawang money flow na dulot ng isang claim:
  - Flow A (collection/assessment): sisingilin ang bawat ibang active member ng maliit
    na fixed amount papunta sa sari-sariling ledger nila kapag namatay ang isang
    member. Dati pa itong existing bilang blanket, manually-triggered action
    (processAutomaticDeduction); ang processClaimDeduction sa baba ay parehong
    mekanismo, tumatakbo lang per-claim, gamit ang configurable DeductionSetting rate
    at tinatag ang bawat ledger row ng claimId.
  - Flow B (payout): ang pool na kolekta ng Flow A - ang total na naibawas mula sa
    ledger ng bawat ibang member para sa claim na ito - ay ibinabayad sa beneficiary
    ng namatay na member, na may cap base sa Admin-configured BenefitCapSetting. Ang
    kahit anong surplus pataas sa cap ay income ng cooperative. Ang OWN ledger
    balance ng namatay na member ay sadyang hindi ang payout figure: personal
    contribution balance niya ito, hindi ang death benefit. */
const Claim = require('../models/Claim');
const DeductionSetting = require('../models/DeductionSetting');
const BenefitCapSetting = require('../models/BenefitCapSetting');
const Ledger = require('../models/Ledger');
const { Member } = require('../../../shared/models');
const { v4: uuidv4 } = require('uuid');
const { getPaginationParams, buildPaginatedResponse } = require('../../../shared/utils/pagination');
const { getMemberBalanceSnapshots } = require('./deductionController');
const { getClaimFinancialTotals } = require('./dashboardController');
const { createAuditLog } = require('../../../shared/services/auditLoggingService');
const { getLatestBalance } = require('../utils/ledgerBalance');
const { safeErrorMessage } = require('../../../middleware/errorHandler');
const {
  DEFAULT_MAX_BENEFIT_AMOUNT,
  benefitPayoutFor,
  benefitSurplusFor,
} = require('../config/claimBenefit');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Tumutugma ito sa DEFAULT_DEDUCTION_AMOUNT sa deductionSettingController - ginagamit
lang kung walang rate row pa (auto-seeds ang Admin screen ng isa sa first view). */
const FALLBACK_DEDUCTION_AMOUNT = 25;

/* Ang per-member deduction ay naka-set ng Admin sa Deduction Settings at hindi
pagpipilian ng Treasurer, kaya parehong preview at real run ay rito rinesolve imbes
na umasa sa kung ano man galing sa request. Dahil dito, siguradong yung amount na
napreview ay yung talagang sisingilin. */
const resolveDeductionRate = async () => {
  const setting = await DeductionSetting.findOne({ status: 'active' });
  return {
    amount: setting?.amount ?? FALLBACK_DEDUCTION_AMOUNT,
    settingId: setting?.settingId,
  };
};

/* Ang benefit cap ay naka-set ng Admin sa Fund Settings → Benefit Cap at hindi
pagpipilian ng Treasurer, kaya rito rinesolve ang bawat payout calculation imbes na
umasa sa kung ano man galing sa request - parehong pattern ng resolveDeductionRate sa
taas. */
const resolveBenefitCap = async () => {
  const setting = await BenefitCapSetting.findOne({ status: 'active' });
  return setting?.amount ?? DEFAULT_MAX_BENEFIT_AMOUNT;
};

/* Parehong ang Awaiting Release list at releaseClaim ay rito rinesolve ang payout
para yung figure na napreview ay yung talagang ireleases. Naitatala ang
totalCollected sa claim nung oras ng deduction; nasa config/claimBenefit ang split
formula para sumusunod ang dashboards sa parehong rule - rinesolve lang isang beses
ang cap per request (tingnan ang call sites) at ipinapasa na lang imbes na
re-queried per claim. */
const resolvePayoutAmount = (claim, cap) => benefitPayoutFor(claim?.deduction?.totalCollected ?? 0, cap);

/* Lahat ng claim kahit anong status - ito ang backing ng Claims Report at
Deductions & Payouts tabs ng Reports screen, na kailangan ng buong list imbes na
isang lifecycle stage lang gaya ng mga method sa baba. Mirror ito ng
claimController.getAllClaims (Admin equivalent), pero scoped sa authenticated route
ng Treasurer. */
const listAllClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { claimId: regex },
        { memberName: regex },
        { beneficiaryName: regex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: -1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching all claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims',
      error: safeErrorMessage(error),
    });
  }
};

/* Ang claim na naka-"pending_deduction" ay mismong notification na sa Treasurer -
walang generic in-app notification system ang codebase na ito para sa claims, kaya
live query ang pragmatic mechanism dito. */
const listPendingDeduction = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const query = { status: 'pending_deduction' };
    if (req.query.search?.trim()) {
      const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching pending-deduction claims:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending-deduction claims',
      error: safeErrorMessage(error),
    });
  }
};

const listAwaitingRelease = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const query = { status: 'deduction_processed' };
    if (req.query.search?.trim()) {
      const regex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ dateFiled: 1 }).skip(skip).limit(limit).lean();

    /* Ang payout ay derived galing sa kolekta para sa claim - hindi pagpipilian ito ng
    Treasurer - kaya ipapadala explicitly ang resolved split para maipakita read-only
    ng disbursement form. */
    const cap = await resolveBenefitCap();
    const withPayout = claims.map((claim) => {
      const payoutAmount = resolvePayoutAmount(claim, cap);
      return {
        ...claim,
        payoutAmount,
        retainedAmount: Math.round(((claim.deduction?.totalCollected ?? 0) - payoutAmount) * 100) / 100,
        maxBenefitAmount: cap,
      };
    });

    res.status(200).json(buildPaginatedResponse(withPayout, total, page, limit));
  } catch (error) {
    console.error('Error fetching claims awaiting release:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claims awaiting release',
      error: safeErrorMessage(error),
    });
  }
};

/* Ang Claim Disbursement Report - lahat ng claim na naibayad na, para sa
record-keeping (DV number, sino nagrelease, kailan, magkano). */
const listReleasedClaims = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search } = req.query;
    const query = { status: 'released' };

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { claimId: regex },
        { memberName: regex },
        { beneficiaryName: regex },
        { 'payout.dvNumber': regex },
      ];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query).sort({ 'payout.releasedAt': -1 }).skip(skip).limit(limit);

    res.status(200).json(buildPaginatedResponse(claims, total, page, limit));
  } catch (error) {
    console.error('Error fetching disbursement report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching disbursement report',
      error: safeErrorMessage(error),
    });
  }
};

/* Ang Claims Income Report - isang row per claim na nakarating na sa deduction stage,
nagpapakita kung saan napunta ang pera: kolekta mula sa members, release sa
beneficiary, at retained ng cooperative. Ito ang per-claim breakdown sa likod ng
tatlong dashboard tiles, para makita ng Treasurer kung aling mga claim ang
gumawa ng totals imbes na totals lang.

Derived ang income sa parehong paraan ng pagderive ni getClaimFinancialTotals, at sa
parehong dahilan: ang actual payout kapag settled na ang claim, ang capped projection
bago mangyari yun. Ang dahilan kung bakit nasa config/claimBenefit ang rule ay para
manatiling sync ang dalawa imbes na isulat nang hiwalay sa bawat isa. */
const listClaimFinancials = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const { search } = req.query;

    // Claims that never reached a deduction have no money to report on.
    const query = { 'deduction.totalCollected': { $gt: 0 } };
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ claimId: regex }, { memberName: regex }, { beneficiaryName: regex }];
    }

    const total = await Claim.countDocuments(query);
    const claims = await Claim.find(query)
      .sort({ 'deduction.processedAt': -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const cap = await resolveBenefitCap();
    const round = (n) => Math.round((n || 0) * 100) / 100;
    const rows = claims.map((claim) => {
      const collected = claim.deduction?.totalCollected ?? 0;
      const released = claim.payout?.amount ?? null;
      const settled = released != null;
      return {
        claimId: claim.claimId,
        memberName: claim.memberName,
        beneficiaryName: claim.beneficiaryName,
        status: claim.status,
        amountPerMember: claim.deduction?.amountPerMember ?? 0,
        membersCharged: claim.deduction?.membersCharged ?? 0,
        totalCollected: collected,
        // Still held for an unreleased claim, matching the dashboard tile.
        amountHeld: settled ? 0 : collected,
        // null until released, so the UI can show "pending" rather than ₱0.
        amountReleased: released,
        /* Nareresognize ang income pag narelease na, kaya 0 ang contribution ng unsettled
        claim sa totals. Display-only lang ang projections sa baba: kung ano ang IRERELEASE
        at IREREtain ng claim na ito, ipinapakita greyed out para hindi malito ang forecast
        sa pera na talagang gumalaw na. */
        netIncome: settled ? round(collected - released) : 0,
        projectedRelease: benefitPayoutFor(collected, cap),
        projectedIncome: benefitSurplusFor(collected, cap),
        settled,
        capApplied: collected > cap,
        processedAt: claim.deduction?.processedAt ?? null,
        releasedAt: claim.payout?.releasedAt ?? null,
        dvNumber: claim.payout?.dvNumber ?? null,
      };
    });

    /* Sakop ng totals lahat ng matching claim, hindi lang yung page na ipinapakita -
    magiging misleading kung ang report footer ay idadagdag lang base sa current page. */
    const totals = await getClaimFinancialTotals(query);

    res.status(200).json({
      ...buildPaginatedResponse(rows, total, page, limit),
      totals,
      maxBenefitAmount: cap,
    });
  } catch (error) {
    console.error('Error fetching claim income report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim income report',
      error: safeErrorMessage(error),
    });
  }
};

const getClaimById = async (req, res) => {
  try {
    const { claimId } = req.params;

    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }

    const member = await Member.findOne({ memberId: claim.memberId });

    res.status(200).json({ success: true, data: { claim, member } });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching claim',
      error: safeErrorMessage(error),
    });
  }
};

/* Read-only dry run ng Flow A - para makita ng Treasurer kung sino eksakto at
magkano ang maaapektuhan ng deduction na ito bago ito icommit. Parehong member
snapshot na ginagamit ng processClaimDeduction, wala lang itong isusulat. */
const previewClaimDeduction = async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await Claim.findOne({ claimId });
    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    if (claim.status !== 'pending_deduction') {
      return res.status(400).json({
        success: false,
        message: `Claim cannot be previewed for deduction from status "${claim.status}"`,
      });
    }

    const { amount: amountPerMember } = await resolveDeductionRate();

    if (isNaN(amountPerMember) || amountPerMember <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deduction amount' });
    }

    const { members } = await getMemberBalanceSnapshots();
    const membersCharged = members.length;
    const totalCollected = Math.round(amountPerMember * membersCharged * 100) / 100;
    const membersGoingNegative = members.filter((m) => (m.balance || 0) - amountPerMember < 0).length;

    res.status(200).json({
      success: true,
      data: {
        claimId,
        memberName: claim.memberName,
        amountPerMember,
        membersCharged,
        totalCollected,
        membersGoingNegative,
      },
    });
  } catch (error) {
    console.error('Error previewing claim deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error previewing claim deduction',
      error: safeErrorMessage(error),
    });
  }
};

/* Flow A, per claim: sisingilin ang bawat ibang active member ng configured rate,
parehong mekanismo ng blanket automatic-deduction, tinag sa claim na ito. */
const processClaimDeduction = async (req, res) => {
  try {
    const { claimId } = req.params;
    const processedBy = req.user?.username || 'treasurer';
    const jvNumber = String(req.body.jvNumber || '').trim();

    if (!jvNumber) {
      return res.status(400).json({
        success: false,
        message: 'JV (Journal Disbursement) number is required before processing the deduction',
      });
    }

    /* Atomically kinukuha dito ang exclusive right ng request na ito para iproseso ang
    deduction. Kung dumating sabay ang dalawang request para sa parehong claim
    (double-click, retried request, dalawang open tabs), yun lang talagang nakapagpalit
    ng pending_deduction -> deduction_processing ang mananalo - ang isa ay makukuha ng
    null pabalik at mareject sa baba, imbes na dalawa silang magsisingil sa lahat ng
    active member. */
    const claim = await Claim.findOneAndUpdate(
      { claimId, status: 'pending_deduction' },
      { $set: { status: 'deduction_processing' } },
      { new: true }
    );
    if (!claim) {
      const existing = await Claim.findOne({ claimId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Claim not found' });
      }
      return res.status(400).json({
        success: false,
        message: `Claim cannot be processed for deduction from status "${existing.status}"`,
      });
    }

    /* Idineklara dito (hindi sa loob ng try sa baba) dahil kailangan pa rin itong basahin
    ng audit log at response na gagawin pagkatapos ng try block na iyon. */
    let before, deductionAmount, totalCollected = 0, membersCharged = 0;

    try {
      let deductionSettingId;
      ({ amount: deductionAmount, settingId: deductionSettingId } = await resolveDeductionRate());

      if (isNaN(deductionAmount) || deductionAmount <= 0) {
        throw Object.assign(new Error('Invalid deduction amount'), { statusCode: 400 });
      }

      const { members } = await getMemberBalanceSnapshots();

      for (const member of members) {
        try {
          const currentBalance = member.balance || 0;
          const newBalance = currentBalance - deductionAmount;

          const ledgerEntry = new Ledger({
            ledgerId: uuidv4(),
            memberId: member.memberId,
            transactionType: 'automatic_deduction',
            description: `Death fund assessment for ${claim.memberName}`,
            debit: deductionAmount,
            credit: 0,
            balance: newBalance,
            referenceId: jvNumber,
            transactionDate: new Date(),
            recordedBy: processedBy,
          });
          await ledgerEntry.save();

          totalCollected += deductionAmount;
          membersCharged += 1;

        } catch (memberError) {
          console.error(`Error processing deduction for member ${member.memberId}:`, memberError);
        }
      }

      before = claim.toObject();
      const now = new Date();
      claim.status = 'deduction_processed';
      claim.deduction = {
        deductionSettingId,
        jvNumber,
        amountPerMember: deductionAmount,
        membersCharged,
        totalCollected,
        processedBy,
        processedAt: now,
      };
      claim.statusHistory.push({
        status: 'deduction_processed',
        changedBy: processedBy,
        changedAt: now,
        notes: `JV ${jvNumber}: charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total)`,
      });

      await claim.save();
    } catch (error) {
      /* Ibabalik ang lock para hindi matagalang tigil ang claim sa "deduction_processing"
      kapag nagfail sa gitna ang rate lookup, member snapshot, o final save - para
      puwedeng i-retry ng Treasurer mula sa parehong pending_deduction state. */
      await Claim.updateOne({ claimId, status: 'deduction_processing' }, { $set: { status: 'pending_deduction' } });
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      throw error;
    }

    await createAuditLog({
      userId: req.user?.userId,
      userName: processedBy,
      userRole: req.user?.role || 'treasurer',
      action: 'claim_deduction_processed',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `JV ${jvNumber}: charged ${membersCharged} active members ₱${deductionAmount} each (₱${totalCollected} total) for claim ${claim.claimId}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: `Deduction processed for ${membersCharged} members`,
      data: claim,
    });
  } catch (error) {
    console.error('Error processing claim deduction:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing claim deduction',
      error: safeErrorMessage(error),
    });
  }
};

/* Flow B, per claim: babayaran ang pool na kolekta sa Flow A papunta sa beneficiary -
ito ang recording step ng Claim Disbursement. Required ang DV (Disbursement Voucher)
number dahil ito ang physical paper trail na umaasa na rito mismo ang accounting ng
cooperative. */
const releaseClaim = async (req, res) => {
  try {
    const { claimId } = req.params;
    const { paymentMethod, dvNumber, releaseDate, remarks } = req.body;
    const releasedBy = req.user?.username || 'treasurer';

    if (!dvNumber?.trim()) {
      return res.status(400).json({ success: false, message: 'A DV (Disbursement Voucher) number is required' });
    }

    /* Atomically kinukuha dito ang exclusive right ng request na ito para irelease ang
    benefit - parehong reasoning ng processClaimDeduction sa taas: kung dumating sabay
    ang dalawang request para sa parehong claim, yun lang talagang nakapagpalit ng
    deduction_processed -> releasing ang mananalo, kaya isa lang na payout ledger entry
    ang magagawa kailanman. */
    const claim = await Claim.findOneAndUpdate(
      { claimId, status: 'deduction_processed' },
      { $set: { status: 'releasing' } },
      { new: true }
    );
    if (!claim) {
      const existing = await Claim.findOne({ claimId });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Claim not found' });
      }
      return res.status(400).json({
        success: false,
        message: `Claim cannot be released from status "${existing.status}"`,
      });
    }

    /* Idineklara dito (hindi sa loob ng try sa baba) dahil kailangan pa rin itong basahin
    ng audit log at response na gagawin pagkatapos ng try block na iyon. */
    let before, payoutAmount, totalCollected, retainedAmount;

    try {
      /* Ang death benefit ay ang pool na kolekta mula sa ibang members para sa claim na
      ito, may cap base sa Admin-configured benefit cap. Puwedeng magtype ang Treasurer ng
      mas mababang amount na irerelease (hal. partial disbursement), pero hindi puwedeng
      lumagpas sa cap-bound ceiling na iyon - rinesolve server-side ang maxPayout para
      ang request ay puwede lang humingi ng LESS, hindi ng more. */
      const cap = await resolveBenefitCap();
      totalCollected = claim.deduction?.totalCollected ?? 0;
      const maxPayout = resolvePayoutAmount(claim, cap);

      const hasRequestedAmount = req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '';
      const requestedAmount = hasRequestedAmount ? Number(req.body.amount) : maxPayout;

      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        throw Object.assign(new Error('Invalid payout amount'), { statusCode: 400 });
      }
      if (requestedAmount > maxPayout) {
        throw Object.assign(new Error(`Amount to release cannot exceed ₱${maxPayout.toLocaleString('en-PH')} (the benefit cap applied to this claim).`), { statusCode: 400 });
      }

      payoutAmount = Math.round(requestedAmount * 100) / 100;
      /* Ang surplus na hindi nairelease - withheld man dahil sa cap o dahil nagrelease ng
      mas mababa ang Treasurer kaysa sa ceiling - ay income ng cooperative. Direktang
      binabasa ni getClaimFinancialTotals ang claim.payout.amount, kaya tugma na ito sa
      kung anumang amount na talagang nairelease dito. */
      retainedAmount = Math.round((totalCollected - payoutAmount) * 100) / 100;

      const parsedReleaseDate = releaseDate ? new Date(releaseDate) : new Date();
      const effectiveReleaseDate = isNaN(parsedReleaseDate.getTime()) ? new Date() : parsedReleaseDate;

      const currentBalance = await getLatestBalance(claim.memberId);
      before = claim.toObject();

      /* Dumadaan lang ang payout SA ledger ng namatay na member imbes na galing dito:
      ang pera ay mula sa assessment na sisingilin sa ibang members, kaya naitatala ito
      bilang credit-in/debit-out sa same row at hindi nagagalaw ang sariling contribution
      balance ng namatay na member. Ang released benefit lang ang naitatala dito - ang
      retained surplus ay income ng cooperative at wala itong lipat sa kahit kaninong
      ledger. */
      const ledgerEntry = new Ledger({
        ledgerId: uuidv4(),
        memberId: claim.memberId,
        transactionType: 'claim_payout',
        description: `Death benefit payout to ${claim.beneficiaryName} from death fund assessment (DV# ${dvNumber.trim()})`,
        credit: payoutAmount,
        debit: payoutAmount,
        balance: currentBalance,
        referenceId: claimId,
        beneficiary: claim.beneficiaryName,
        paymentMethod: paymentMethod || 'cash',
        transactionDate: effectiveReleaseDate,
        recordedBy: releasedBy,
      });
      await ledgerEntry.save();

      const now = new Date();
      claim.status = 'released';
      claim.payout = {
        amount: payoutAmount,
        paymentMethod: paymentMethod || 'cash',
        dvNumber: dvNumber.trim(),
        remarks: remarks?.trim() || undefined,
        releasedBy,
        releasedAt: effectiveReleaseDate,
        ledgerId: ledgerEntry.ledgerId,
      };
      claim.statusHistory.push({
        status: 'released',
        changedBy: releasedBy,
        changedAt: now,
        notes: retainedAmount > 0
          ? `₱${payoutAmount} released to ${claim.beneficiaryName} (DV# ${dvNumber.trim()}); ₱${retainedAmount} of the ₱${totalCollected} collected retained as cooperative income`
          : `₱${payoutAmount} released to ${claim.beneficiaryName} (DV# ${dvNumber.trim()})`,
      });

      await claim.save();
    } catch (error) {
      /* Ibabalik ang lock para hindi matagalang tigil ang claim sa "releasing" kapag
      nagfail sa gitna ang validation check o final save - para puwedeng i-retry ng
      Treasurer mula sa parehong deduction_processed state. */
      await Claim.updateOne({ claimId, status: 'releasing' }, { $set: { status: 'deduction_processed' } });
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      throw error;
    }

    await createAuditLog({
      userId: req.user?.userId,
      userName: releasedBy,
      userRole: req.user?.role || 'treasurer',
      action: 'claim_released',
      module: 'mortuary',
      entityType: 'claim',
      entityId: claim.claimId,
      entityName: claim.memberName,
      description: `Released ₱${payoutAmount} of ₱${totalCollected} collected to ${claim.beneficiaryName} for claim ${claim.claimId} (DV# ${dvNumber.trim()})${retainedAmount > 0 ? `; ₱${retainedAmount} retained as cooperative income` : ''}`,
      changes: { before, after: claim.toObject() },
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Claim released successfully',
      data: claim,
    });
  } catch (error) {
    console.error('Error releasing claim:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing claim',
      error: safeErrorMessage(error),
    });
  }
};

module.exports = {
  listAllClaims,
  listPendingDeduction,
  listAwaitingRelease,
  listReleasedClaims,
  listClaimFinancials,
  getClaimById,
  processClaimDeduction,
  previewClaimDeduction,
  releaseClaim,
};
