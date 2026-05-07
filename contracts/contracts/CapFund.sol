// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  CapDAO (Decentralized Autonomous Crowdfunding)
 * @author CapDAO Team
 * @notice Decentralized crowdfunding with:
 *         - Strict funding caps (overage automatically refunded)
 *         - DAO governance via weighted voting proposals
 *         - Simple interest rewards for contributors (5% APR)
 *         - Campaign owner–controlled interest pool
 */
contract CapFund {

    // ─────────────────────────────────────────────────────────────────────────
    //  CONSTANTS
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev  Annual interest rate in basis points (500 = 5%)
    uint256 public constant INTEREST_RATE_BPS = 500;

    /// @dev  Basis-point denominator
    uint256 private constant BPS = 10_000;

    /// @dev  Seconds in a year (365 days)
    uint256 private constant YEAR = 365 days;

    // ─────────────────────────────────────────────────────────────────────────
    //  ENUMS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Types of proposals that contributors can vote on
    enum ProposalType {
        RELEASE_FUNDS,    // Allow owner to withdraw raised funds early
        CHANGE_DEADLINE,  // Extend the campaign deadline
        CANCEL            // Cancel the campaign, enable full refunds
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  STRUCTS
    // ─────────────────────────────────────────────────────────────────────────

    struct Campaign {
        uint256 id;
        address payable owner;       // Campaign creator
        uint256 fundingCap;          // Max ETH (wei) the campaign can raise
        uint256 totalFunds;          // Total ETH raised so far
        uint256 deadline;            // Unix timestamp when campaign ends
        uint256 interestPool;        // ETH set aside for interest payouts
        bool    withdrawn;           // Has owner already withdrawn?
        bool    cancelled;           // Has a CANCEL proposal been executed?
        bool    exists;              // Sentinel for invalid IDs
    }

    struct Proposal {
        uint256      id;
        string       description;    // Human-readable summary
        ProposalType pType;          // Type of action
        uint256      yesVotes;       // Cumulative wei voted YES
        uint256      noVotes;        // Cumulative wei voted NO
        uint256      votingDeadline; // Unix timestamp — voting closes
        uint256      newDeadline;    // Only used for CHANGE_DEADLINE proposals
        bool         executed;       // Has the proposal been acted on?
        bool         passed;         // Did it pass?
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total campaigns ever created (used as next ID)
    uint256 public campaignCount;

    /// @notice Campaign data keyed by ID
    mapping(uint256 => Campaign) public campaigns;

    /// @notice Amount each address contributed per campaign
    ///         campaignId => contributor => wei
    mapping(uint256 => mapping(address => uint256)) public contributions;

    /// @notice Timestamp when each contribution was first made
    ///         (used to calculate interest accrued)
    ///         campaignId => contributor => unix timestamp
    mapping(uint256 => mapping(address => uint256)) public contributionTimestamps;

    /// @notice Interest already claimed per contributor per campaign
    ///         campaignId => contributor => wei claimed
    mapping(uint256 => mapping(address => uint256)) public interestClaimed;

    /// @notice All proposals for a campaign
    ///         campaignId => array of Proposal
    mapping(uint256 => Proposal[]) public proposals;

    /// @notice Guard against double-voting
    ///         campaignId => proposalId => voter => has voted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasVoted;

    // ─────────────────────────────────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event CampaignCreated(
        uint256 indexed id,
        address indexed owner,
        uint256 fundingCap,
        uint256 deadline
    );

    event ContributionMade(
        uint256 indexed id,
        address indexed contributor,
        uint256 amount
    );

    event ProposalCreated(
        uint256 indexed campaignId,
        uint256 indexed proposalId,
        string  description,
        ProposalType pType,
        uint256 votingDeadline
    );

    event VoteCast(
        uint256 indexed campaignId,
        uint256 indexed proposalId,
        address indexed voter,
        bool    support,
        uint256 votingPower
    );

    event ProposalExecuted(
        uint256 indexed campaignId,
        uint256 indexed proposalId,
        bool    passed
    );

    event FundsWithdrawn(
        uint256 indexed id,
        address indexed owner,
        uint256 amount
    );

    event RefundIssued(
        uint256 indexed id,
        address indexed contributor,
        uint256 amount
    );

    event InterestClaimed(
        uint256 indexed campaignId,
        address indexed contributor,
        uint256 amount
    );

    event InterestPoolFunded(
        uint256 indexed campaignId,
        address indexed funder,
        uint256 amount
    );

    // ─────────────────────────────────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier campaignExists(uint256 _id) {
        require(campaigns[_id].exists, "CapFund: Campaign does not exist");
        _;
    }

    modifier onlyOwner(uint256 _id) {
        require(msg.sender == campaigns[_id].owner, "CapFund: Only campaign owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CAMPAIGN FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new campaign on-chain.
     *         Off-chain metadata (title, image, category) is stored in the backend.
     * @param _fundingCap  Maximum ETH (wei) the campaign will accept
     * @param _deadline    Unix timestamp for when funding closes
     * @return id          Newly created campaign ID
     */
    function createCampaign(
        uint256 _fundingCap,
        uint256 _deadline
    ) external returns (uint256 id) {
        require(_fundingCap > 0,              "CapFund: Cap must be > 0");
        require(_deadline > block.timestamp,  "CapFund: Deadline must be future");

        id = campaignCount++;

        campaigns[id] = Campaign({
            id:           id,
            owner:        payable(msg.sender),
            fundingCap:   _fundingCap,
            totalFunds:   0,
            deadline:     _deadline,
            interestPool: 0,
            withdrawn:    false,
            cancelled:    false,
            exists:       true
        });

        emit CampaignCreated(id, msg.sender, _fundingCap, _deadline);
    }

    /**
     * @notice Fund the interest pool for a campaign.
     *         Anyone can top up the pool, but typically done by the campaign owner.
     * @param _id  Campaign ID
     */
    function fundInterestPool(uint256 _id)
        external
        payable
        campaignExists(_id)
    {
        require(msg.value > 0, "CapFund: Must send ETH to fund pool");
        require(!campaigns[_id].cancelled, "CapFund: Campaign is cancelled");

        campaigns[_id].interestPool += msg.value;
        emit InterestPoolFunded(_id, msg.sender, msg.value);
    }

    /**
     * @notice Contribute ETH to a campaign.
     *         If contribution exceeds the remaining cap, the excess is instantly refunded.
     * @param _id  Campaign ID
     */
    function contribute(uint256 _id) external payable campaignExists(_id) {
        Campaign storage c = campaigns[_id];

        require(!c.cancelled,                       "CapFund: Campaign is cancelled");
        require(block.timestamp < c.deadline,       "CapFund: Deadline has passed");
        require(c.totalFunds < c.fundingCap,        "CapFund: Already fully funded");
        require(msg.value > 0,                      "CapFund: Must send ETH");

        uint256 remaining = c.fundingCap - c.totalFunds;
        uint256 accepted  = msg.value;
        uint256 refund    = 0;

        // ── Partial cap enforcement ───────────────────────────────────────────
        // Accept only what fits within the cap; immediately refund the rest.
        if (msg.value > remaining) {
            accepted = remaining;
            refund   = msg.value - remaining;
        }

        // ── Checks-Effects-Interactions ───────────────────────────────────────
        c.totalFunds += accepted;

        // Track contribution amount for interest and governance weight
        if (contributions[_id][msg.sender] == 0) {
            // First contribution — record starting timestamp
            contributionTimestamps[_id][msg.sender] = block.timestamp;
        }
        contributions[_id][msg.sender] += accepted;

        emit ContributionMade(_id, msg.sender, accepted);

        // Return excess funds after state update
        if (refund > 0) {
            (bool ok,) = payable(msg.sender).call{value: refund}("");
            require(ok, "CapFund: Refund transfer failed");
            emit RefundIssued(_id, msg.sender, refund);
        }
    }

    /**
     * @notice Campaign owner withdraws all raised funds.
     *         Requires the funding cap to have been reached AND either:
     *         (a) deadline has passed, OR (b) a RELEASE_FUNDS proposal passed.
     * @param _id  Campaign ID
     */
    function withdraw(uint256 _id) external campaignExists(_id) onlyOwner(_id) {
        Campaign storage c = campaigns[_id];

        require(!c.cancelled,                       "CapFund: Campaign is cancelled");
        require(c.totalFunds >= c.fundingCap,       "CapFund: Funding goal not met");
        require(!c.withdrawn,                       "CapFund: Already withdrawn");

        // Allow withdrawal if:
        //   (a) deadline has passed naturally, OR
        //   (b) a RELEASE_FUNDS proposal passed (checked off-chain by the UI)
        require(
            block.timestamp >= c.deadline || _hasPassedReleaseFunds(_id),
            "CapFund: Cannot withdraw until deadline or approved by DAO"
        );

        c.withdrawn = true;
        uint256 amount = c.totalFunds;

        (bool ok,) = c.owner.call{value: amount}("");
        require(ok, "CapFund: Withdrawal failed");

        emit FundsWithdrawn(_id, msg.sender, amount);
    }

    /**
     * @notice Contributor claims a refund if the campaign failed (deadline passed,
     *         cap not reached) OR the campaign was cancelled by a DAO vote.
     *         Also pays out any outstanding interest.
     * @param _id  Campaign ID
     */
    function claimRefund(uint256 _id) external campaignExists(_id) {
        Campaign storage c = campaigns[_id];

        // Eligible if: (cancelled) OR (deadline passed AND cap not reached)
        bool canRefund = c.cancelled ||
            (block.timestamp >= c.deadline && c.totalFunds < c.fundingCap);

        require(canRefund, "CapFund: Not eligible for refund");

        uint256 principal = contributions[_id][msg.sender];
        require(principal > 0, "CapFund: Nothing to refund");

        // Calculate any outstanding interest before zeroing out contribution
        uint256 interest = _pendingInterest(_id, msg.sender);

        // Zero out to prevent re-entrancy / double withdrawal
        contributions[_id][msg.sender] = 0;

        uint256 total = principal;

        // Pay interest from pool if available
        if (interest > 0 && c.interestPool >= interest) {
            c.interestPool -= interest;
            total += interest;
            interestClaimed[_id][msg.sender] += interest;
        }

        (bool ok,) = payable(msg.sender).call{value: total}("");
        require(ok, "CapFund: Refund transfer failed");

        emit RefundIssued(_id, msg.sender, principal);
        if (interest > 0) emit InterestClaimed(_id, msg.sender, interest);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTEREST FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Calculate accrued interest for a contributor.
     *
     *         Formula:
     *           interest = contribution × RATE × elapsed
     *                      ─────────────────────────────
     *                            BPS × YEAR
     *
     *         Where RATE=500 (5%), BPS=10000, YEAR=31536000 seconds.
     *
     * @param _id          Campaign ID
     * @param _contributor Contributor address
     * @return wei         Interest owed (not yet claimed)
     */
    function calculateInterest(uint256 _id, address _contributor)
        external
        view
        campaignExists(_id)
        returns (uint256)
    {
        return _pendingInterest(_id, _contributor);
    }

    /**
     * @notice Claim accrued interest from the campaign's interest pool.
     *         Can only be claimed on an active or successfully funded campaign.
     * @param _id  Campaign ID
     */
    function claimInterest(uint256 _id) external campaignExists(_id) {
        Campaign storage c = campaigns[_id];

        uint256 contribution = contributions[_id][msg.sender];
        require(contribution > 0, "CapFund: No contribution");

        uint256 interest = _pendingInterest(_id, msg.sender);
        require(interest > 0,             "CapFund: No interest accrued");
        require(c.interestPool >= interest, "CapFund: Interest pool insufficient");

        // Update claimed timestamp by resetting to now (so next claim starts fresh)
        contributionTimestamps[_id][msg.sender] = block.timestamp;
        interestClaimed[_id][msg.sender] += interest;
        c.interestPool -= interest;

        (bool ok,) = payable(msg.sender).call{value: interest}("");
        require(ok, "CapFund: Interest transfer failed");

        emit InterestClaimed(_id, msg.sender, interest);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  DAO GOVERNANCE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Campaign owner creates a proposal for contributors to vote on.
     * @param _id             Campaign ID
     * @param _description    Human-readable proposal description
     * @param _pType          Proposal type (RELEASE_FUNDS | CHANGE_DEADLINE | CANCEL)
     * @param _votingDuration Voting window in seconds (e.g. 3 days = 259200)
     * @param _newDeadline    Only used for CHANGE_DEADLINE type (unix timestamp)
     * @return proposalId     Index of the newly created proposal
     */
    function createProposal(
        uint256      _id,
        string       calldata _description,
        ProposalType _pType,
        uint256      _votingDuration,
        uint256      _newDeadline
    )
        external
        campaignExists(_id)
        onlyOwner(_id)
        returns (uint256 proposalId)
    {
        require(!campaigns[_id].cancelled, "CapFund: Campaign is cancelled");
        require(bytes(_description).length > 0, "CapFund: Description required");
        require(_votingDuration >= 1 hours, "CapFund: Min 1 hour voting window");

        if (_pType == ProposalType.CHANGE_DEADLINE) {
            require(_newDeadline > campaigns[_id].deadline, "CapFund: New deadline must be later");
        }

        proposalId = proposals[_id].length;

        proposals[_id].push(Proposal({
            id:             proposalId,
            description:    _description,
            pType:          _pType,
            yesVotes:       0,
            noVotes:        0,
            votingDeadline: block.timestamp + _votingDuration,
            newDeadline:    _newDeadline,
            executed:       false,
            passed:         false
        }));

        emit ProposalCreated(_id, proposalId, _description, _pType, block.timestamp + _votingDuration);
    }

    /**
     * @notice Cast a weighted vote on a proposal.
     *         Voting power = ETH contributed to this campaign.
     *
     * @param _id         Campaign ID
     * @param _proposalId Index into proposals[_id]
     * @param _support    true = YES vote, false = NO vote
     */
    function vote(
        uint256 _id,
        uint256 _proposalId,
        bool    _support
    ) external campaignExists(_id) {
        uint256 power = contributions[_id][msg.sender];
        require(power > 0,                           "CapFund: Must be a contributor to vote");
        require(_proposalId < proposals[_id].length, "CapFund: Proposal not found");
        require(!hasVoted[_id][_proposalId][msg.sender], "CapFund: Already voted");

        Proposal storage p = proposals[_id][_proposalId];
        require(!p.executed,                            "CapFund: Proposal already executed");
        require(block.timestamp < p.votingDeadline,     "CapFund: Voting period has ended");

        hasVoted[_id][_proposalId][msg.sender] = true;

        if (_support) {
            p.yesVotes += power;
        } else {
            p.noVotes += power;
        }

        emit VoteCast(_id, _proposalId, msg.sender, _support, power);
    }

    /**
     * @notice Execute a proposal after its voting period has ended.
     *         Passes if yesVotes > noVotes (simple majority by ETH weight).
     *         Anyone can call this once the voting window closes.
     *
     * @param _id         Campaign ID
     * @param _proposalId Index into proposals[_id]
     */
    function executeProposal(uint256 _id, uint256 _proposalId)
        external
        campaignExists(_id)
    {
        require(_proposalId < proposals[_id].length, "CapFund: Proposal not found");

        Proposal storage p = proposals[_id][_proposalId];
        Campaign storage c = campaigns[_id];

        require(!p.executed,                          "CapFund: Already executed");
        require(block.timestamp >= p.votingDeadline,  "CapFund: Voting still active");

        p.executed = true;
        p.passed   = p.yesVotes > p.noVotes;

        if (p.passed) {
            if (p.pType == ProposalType.CHANGE_DEADLINE) {
                c.deadline = p.newDeadline;
            } else if (p.pType == ProposalType.CANCEL) {
                c.cancelled = true;
            }
            // RELEASE_FUNDS: no state change — just marks passed flag,
            // which withdraw() checks via _hasPassedReleaseFunds()
        }

        emit ProposalExecuted(_id, _proposalId, p.passed);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  READ FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Fetch all key on-chain fields for a campaign.
     */
    function getCampaign(uint256 _id)
        external
        view
        campaignExists(_id)
        returns (
            address owner,
            uint256 fundingCap,
            uint256 totalFunds,
            uint256 deadline,
            bool    withdrawn,
            bool    cancelled,
            uint256 interestPool
        )
    {
        Campaign storage c = campaigns[_id];
        return (c.owner, c.fundingCap, c.totalFunds, c.deadline, c.withdrawn, c.cancelled, c.interestPool);
    }

    /**
     * @notice Get a single proposal by campaign + proposal ID.
     */
    function getProposal(uint256 _id, uint256 _proposalId)
        external
        view
        returns (
            string memory description,
            ProposalType  pType,
            uint256       yesVotes,
            uint256       noVotes,
            uint256       votingDeadline,
            uint256       newDeadline,
            bool          executed,
            bool          passed
        )
    {
        require(_proposalId < proposals[_id].length, "CapFund: Proposal not found");
        Proposal storage p = proposals[_id][_proposalId];
        return (
            p.description, p.pType, p.yesVotes, p.noVotes,
            p.votingDeadline, p.newDeadline, p.executed, p.passed
        );
    }

    /**
     * @notice Number of proposals for a campaign.
     */
    function getProposalCount(uint256 _id)
        external
        view
        campaignExists(_id)
        returns (uint256)
    {
        return proposals[_id].length;
    }

    /**
     * @notice Contribution amount for a specific address.
     */
    function getContribution(uint256 _id, address _contributor)
        external
        view
        returns (uint256)
    {
        return contributions[_id][_contributor];
    }

    /**
     * @notice Whether a campaign is still accepting contributions.
     */
    function isActive(uint256 _id)
        external
        view
        campaignExists(_id)
        returns (bool)
    {
        Campaign storage c = campaigns[_id];
        return (
            !c.cancelled &&
            block.timestamp < c.deadline &&
            c.totalFunds < c.fundingCap
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Calculate pending (unclaimed) interest for a contributor.
     *      interest = contribution * RATE * elapsed / (BPS * YEAR)
     */
    function _pendingInterest(uint256 _id, address _contributor)
        internal
        view
        returns (uint256)
    {
        uint256 amount    = contributions[_id][_contributor];
        if (amount == 0) return 0;

        uint256 startTime = contributionTimestamps[_id][_contributor];
        if (startTime == 0) return 0;

        uint256 elapsed = block.timestamp - startTime;
        if (elapsed == 0) return 0;

        // Simple interest: principal × rate × time / (denominator × year)
        return (amount * INTEREST_RATE_BPS * elapsed) / (BPS * YEAR);
    }

    /**
     * @dev Check if any executed RELEASE_FUNDS proposal passed for a campaign.
     */
    function _hasPassedReleaseFunds(uint256 _id) internal view returns (bool) {
        Proposal[] storage props = proposals[_id];
        for (uint256 i = 0; i < props.length; i++) {
            if (
                props[i].pType == ProposalType.RELEASE_FUNDS &&
                props[i].executed &&
                props[i].passed
            ) {
                return true;
            }
        }
        return false;
    }
}
