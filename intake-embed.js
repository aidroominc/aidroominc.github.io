// Set only after the delivery service has been authorized and tested.
const intakeServiceUrl='https://script.google.com/macros/s/AKfycbzrerRlV5oExRcRbi5pE2k9isF6sSkWbyhee5Dl5Qax55zylaErrd76VH6BQBPbrXKiiw/exec';
if(intakeServiceUrl){
 const frame=document.createElement('iframe');
 // Load the public form without the visitor's Google account cookies.
 frame.setAttribute('credentialless','');
 frame.src=intakeServiceUrl;frame.title='Aid Room Client Intake Form';frame.className='intake-frame';
 frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
 document.getElementById('intakeMount').replaceChildren(frame);
}



