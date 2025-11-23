# Bonus Score System - Manual Browser Testing Guide

**Date**: 2025-11-23
**Status**: Ready for manual testing

## Quick Start

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Login Credentials**:
   - URL: http://localhost:3000
   - Username: `autoads`
   - Password: `K$j6z!9Tq@P2w#aR`

3. **Test Page**:
   - Navigate to: http://localhost:3000/offers/49/launch
   - Ensure creative 76 has been generated (or generate it)

## What to Test

### 1. Bonus Score Display

**Location**: Below the Ad Strength radar chart on each creative card

**Expected UI**:
```
┌─────────────────────────────────────┐
│ Performance Score                   │
│ Travel > Luggage & Travel Gear      │
├─────────────────────────────────────┤
│         96/100 +16                  │
│       Total: 112/120                │
├─────────────────────────────────────┤
│ 👆 Clicks    500      +4            │
│ 🎯 CTR       4.13%    +4            │
│ 💲 CPC       $0.76    +3            │
│ 🛒 Conv.     5.00%    +5      [Add] │
└─────────────────────────────────────┘
```

**Verify**:
- Base score (96/100) displays correctly
- Bonus score (+16) appears in green
- Total score (112/120) shown below
- Four metrics with color-coded icons
- Industry classification shown at top
- [Add] button visible for conversions

### 2. Bonus Score Tooltips

**Test**: Hover over each metric row

**Expected Behavior**:
- Tooltip appears with benchmark comparison
- Shows industry average vs actual performance
- Displays performance category (excellent/good/average/below/low)

**Example Tooltip**:
```
CTR: 4.13%
Industry Average: 3.18%
Performance: Good (+30% above benchmark)
```

### 3. Conversion Feedback Form

**Test**: Click the [Add] button next to conversions

**Expected Behavior**:
1. Modal dialog opens with title "Report Conversions"
2. Form fields present:
   - Number of Conversions (required, number input)
   - Conversion Value (optional, currency input)
   - Start Date (required, date picker)
   - End Date (required, date picker)
   - Notes (optional, textarea)
3. Cancel and Submit buttons at bottom

**Test Data**:
- Conversions: 30
- Value: $2500.00
- Period: 2025-11-01 to 2025-11-23
- Notes: "Black Friday campaign performance"

**Expected Result**:
- Form submits successfully
- Modal closes
- Bonus score card refreshes
- Conversion score updates (should increase if performance improves)

### 4. Authentication Integration

**Test**: Logout and login again, then access the page

**Expected Behavior**:
- After logout: Redirected to login page
- After login: Can access /offers/49/launch
- Bonus score data loads correctly
- Conversion feedback submission uses authenticated user

**Verify**:
- No hardcoded user IDs in network requests
- Authentication cookie sent with API calls
- 401 Unauthorized if not logged in

## API Endpoints to Monitor (DevTools Network Tab)

1. **GET** `/api/ad-creatives/76/bonus-score`
   - Should return 200 OK
   - Response includes bonusScore, breakdown, performance data

2. **POST** `/api/ad-creatives/76/conversion-feedback`
   - Should return 200 OK on valid submission
   - Response includes updated bonusScore
   - Check request includes `credentials: 'include'`

3. **POST** `/api/sync-performance`
   - (Future) Trigger manual sync from Google Ads API

## Known Test Data (Creative 76)

Based on automated tests, creative 76 should show:

- **Industry**: Travel > Luggage & Travel Gear
- **Clicks**: 500
- **CTR**: 4.13% (benchmark: 3.18%)
- **CPC**: $0.76 (benchmark: $0.95)
- **Conversions**: 25 (conversion rate: 5.00%, benchmark: 2.47%)
- **Bonus Score**: 16/20
  - Clicks: 4/5 (good)
  - CTR: 4/5 (good)
  - CPC: 3/5 (average)
  - Conversions: 5/5 (excellent)

## Edge Cases to Test

### No Performance Data Yet
- Creative with no bonus score data should show:
  - Base score only (e.g., "96/100")
  - Message: "No performance data available yet"
  - Grayed out metrics

### Below 100 Clicks Threshold
- Creative with <100 clicks should show:
  - Message: "Minimum 100 clicks required for bonus scoring"
  - Base score only
  - No bonus points added

### Different Industry Classifications
- Test with offers from different categories
- Verify correct industry label displays
- Benchmark values should vary by industry

## Success Criteria

- ✅ Bonus score card displays correctly on all creatives
- ✅ Metrics show correct values and color coding
- ✅ Tooltips display benchmark comparisons
- ✅ Conversion feedback form opens and submits
- ✅ Score updates in real-time after feedback submission
- ✅ Authentication works (no hardcoded users)
- ✅ Industry classification displays correctly
- ✅ UI is responsive and accessible

## Troubleshooting

### Score Not Showing
- Check browser console for errors
- Verify creative ID in network requests
- Check database has performance data for that creative

### Conversion Feedback Fails
- Check authentication (login again if needed)
- Verify form validation (conversions > 0, dates provided)
- Check network tab for error response

### Industry Classification Wrong
- May need to update industry classifier keywords
- Check offer data (brand, category, description)
- Verify industry_benchmarks table has correct data

## Next Steps After Manual Testing

1. **Google Ads API Integration**:
   - Configure credentials
   - Set up automatic daily sync
   - Test sync-performance endpoint

2. **Correlation Analysis**:
   - Collect 10+ samples with bonus scores
   - Trigger analysis to identify patterns
   - Generate optimization insights

3. **Production Deployment**:
   - Verify all environment variables set
   - Test with real Google Ads data
   - Monitor performance and accuracy
