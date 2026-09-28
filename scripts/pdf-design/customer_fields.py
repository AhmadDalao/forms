"""Apply the explicitly requested 2026-09-28 KYC field changes to source schemas."""
import copy

def customer_fields(source):
    schemas=copy.deepcopy(source)
    removed={'kyc-individual':{'issue_place','rep_issue','rep_place'},'kyc-corporate':{'auth_issue_place','auth_issue_date'}}
    for doc in schemas:
        omit=removed.get(doc['id'],set())
        def fields(items):
            result=[]
            for f in items:
                if f['id'] in omit:continue
                if f['id']=='rep_fax':f.update(id='rep_email',label='Email',ar='البريد الإلكتروني',type='email',direction='ltr')
                result.append(f)
            return result
        doc['fields']=fields(doc.get('fields',[]))
        for section in doc.get('sections',[]):
            section['fields']=fields(section['fields'])
            for group in section.get('paperGroups',[]):group['fields']=['rep_email' if id=='rep_fax' else id for id in group['fields'] if id not in omit]
        for slot in doc.get('signatureSlots',[]):
            if 'requireWhenFields' in slot:slot['requireWhenFields']=['rep_email' if id=='rep_fax' else id for id in slot['requireWhenFields'] if id not in omit]
    return schemas
