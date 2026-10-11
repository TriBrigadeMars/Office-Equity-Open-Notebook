#[cfg(target_os = "windows")]
pub fn apply_job_object_to_process(child_handle: winapi::um::winnt::HANDLE) -> Result<(), String> {
    use std::ptr::null_mut;
    use winapi::um::jobapi2::{CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject};
    use winapi::um::winnt::{
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use std::mem::size_of;

    unsafe {
        let job = CreateJobObjectW(null_mut(), null_mut());
        if job.is_null() {
            return Err("Failed to create Job Object".to_string());
        }

        let mut limit_info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        limit_info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        let res = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &mut limit_info as *mut _ as *mut _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );

        if res == 0 {
            return Err("Failed to SetInformationJobObject".to_string());
        }

        let assign_res = AssignProcessToJobObject(job, child_handle);
        if assign_res == 0 {
            return Err("Failed to AssignProcessToJobObject".to_string());
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn apply_job_object_to_process(_child_handle: ()) -> Result<(), String> {
    // Unix: Could use process groups or prctl(PR_SET_PDEATHSIG, SIGKILL)
    Ok(())
}
