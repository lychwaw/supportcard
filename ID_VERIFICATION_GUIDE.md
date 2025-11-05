# ID Verification System Guide

## How ID Verification Works in SupportCard

### Overview
ID verification is a security feature that helps ensure users are who they claim to be. This is especially important for financial applications dealing with child support payments.

### Verification Flow

#### 1. **During Signup** (Optional but Recommended)
- Users can upload a government-issued ID during the signup process
- File is immediately uploaded to Supabase Storage in the `id-verifications` bucket
- Document URL is stored in the user's profile
- Verification status is set to `false` (pending)

#### 2. **After Signup** (Settings Page)
- Users who didn't upload during signup can do so later
- Navigate to Settings > Verification tab
- Upload ID document (JPEG, PNG, or PDF, max 10MB)
- File preview is shown before upload
- Click "Upload ID for Verification" button

### Verification Process

#### Status States:
1. **Not Uploaded** (Blue Alert)
   - User hasn't uploaded any ID yet
   - Shows "Verification Required" message
   - Upload functionality is available

2. **Pending Verification** (Yellow Alert)
   - ID has been uploaded
   - Waiting for admin/staff review
   - Usually takes 24-48 hours
   - User can view their uploaded ID
   - Can update/replace the ID if needed

3. **Verified** (Green Alert)
   - ID has been reviewed and approved
   - User has full access to all features
   - Cannot update ID (locked)
   - Can view verified ID document

### Technical Implementation

#### File Upload
- Files are stored in Supabase Storage bucket: `id-verifications`
- Path format: `id-verifications/{userId}_{timestamp}.{ext}`
- Files are private (not publicly accessible)
- Public URL is generated for user preview

#### Database Schema
```sql
profiles:
  - id_verification_url: TEXT (URL to uploaded document)
  - id_verified: BOOLEAN (true = verified, false = pending/not verified)
```

#### Admin Verification (Manual Process)
Currently, verification is manual:
1. Admin accesses Supabase Storage
2. Reviews uploaded ID documents
3. Updates `id_verified` field to `true` in profiles table
4. User receives notification (future feature)

### Future Enhancements

#### Automated Verification (Recommended for Production)
- **OCR Integration**: Extract text from ID images
- **Third-party Services**: 
  - Onfido (https://onfido.com)
  - Jumio (https://www.jumio.com)
  - Veriff (https://www.veriff.com)
- **AI-powered Validation**: Check ID authenticity
- **Liveness Detection**: Ensure user is present during upload

#### Notification System
- Email notification when verification is complete
- In-app notification badge
- SMS alerts for Premium users

#### Self-Service Updates
- Allow verified users to update ID (requires re-verification)
- Document expiration tracking
- Renewal reminders

### Security Considerations

1. **File Storage**
   - Files stored in private bucket
   - RLS policies prevent unauthorized access
   - Encryption at rest

2. **Data Privacy**
   - ID documents contain sensitive information
   - GDPR/CCPA compliance required
   - Data retention policies needed

3. **Access Control**
   - Only user and admins can view uploaded IDs
   - Log all verification status changes
   - Audit trail for compliance

### User Experience

#### Upload Requirements
- **File Formats**: JPEG, PNG, PDF
- **Max Size**: 10MB
- **Acceptable IDs**: National ID, Passport, Driver's License

#### Visual Feedback
- File preview before upload
- Upload progress indicator
- Clear status indicators (color-coded alerts)
- Helpful error messages

### Admin Panel (To Be Built)

Features needed:
1. Review queue dashboard
2. Approve/Reject functionality
3. Bulk verification
4. Verification history
5. Reports and analytics

### Integration Points

1. **Payment Processing**: Verify ID before allowing large transactions
2. **Subscription Upgrades**: Require verification for Premium tiers
3. **Account Features**: Unlock features after verification
4. **Legal Compliance**: Track verification for audit purposes

## Current Implementation Status

✅ Upload functionality during signup  
✅ Upload functionality in Settings  
✅ File preview  
✅ Status display  
✅ Secure storage  
⏳ Admin review interface (manual for now)  
⏳ Automated verification (future)  
⏳ Notification system (future)  

## Testing the Feature

1. **Signup Flow**: 
   - Create new account
   - Upload ID during signup
   - Check profile has `id_verification_url`

2. **Settings Flow**:
   - Go to Settings > Verification
   - Upload ID document
   - Verify preview appears
   - Check database for URL update

3. **Status Display**:
   - Verified: Green badge, locked upload
   - Pending: Yellow badge, view button
   - Not uploaded: Blue alert, upload enabled

